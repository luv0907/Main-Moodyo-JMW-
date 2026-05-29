import asyncio
import os
import sys
import base64
from typing import Any, Optional
from mcp import StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.session import ClientSession
from jarvis.utils.logger import logger
from jarvis.config import settings

KNOWN_SELECTORS = {
    "search button": "input[name='btnK']",
    "google search": "input[name='btnK']", 
    "first result": "h3:first-of-type",
    "address bar": None
}

def run_async(coro):
    """Run an async coroutine synchronously, handling existing loops."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    if loop.is_running():
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor() as executor:
            return executor.submit(asyncio.run, coro).result()
    else:
        return loop.run_until_complete(coro)

class BrowserController:
    def __init__(self):
        self.server_params = StdioServerParameters(
            command="npx",
            args=["-y", "@playwright/mcp@latest"],
            env=None
        )
        self.session = None
        self._client_context = None
        self._session_context = None
        self._lock = asyncio.Lock()
        
    async def start(self):
        """Start the MCP Playwright server subprocess and initialize session."""
        async with self._lock:
            if self.session is not None:
                return
            
            logger.info("Launching Playwright MCP server...")
            self._client_context = stdio_client(self.server_params)
            read, write = await self._client_context.__aenter__()
            self._session_context = ClientSession(read, write)
            self.session = await self._session_context.__aenter__()
            await self.session.initialize()
            logger.info("Playwright MCP server initialized successfully!")
            
            # Wait for browser context to respond to ping
            try:
                logger.info("Sending initial ping to Playwright MCP server...")
                await self.session.call_tool("browser_navigate", {"url": "about:blank"})
                logger.info("Playwright MCP server is ready!")
            except Exception as e:
                logger.warning(f"Initial ping check did not succeed: {e}")
            
    async def stop(self):
        """Clean up the MCP Playwright session and subprocess."""
        async with self._lock:
            try:
                if self._session_context is not None:
                    logger.info("Stopping ClientSession...")
                    await self._session_context.__aexit__(None, None, None)
            except Exception as e:
                logger.error(f"Error stopping ClientSession: {e}")
            finally:
                self._session_context = None
                self.session = None

            try:
                if self._client_context is not None:
                    logger.info("Stopping stdio_client...")
                    await self._client_context.__aexit__(None, None, None)
            except Exception as e:
                logger.error(f"Error stopping stdio_client: {e}")
            finally:
                self._client_context = None
            logger.info("Playwright MCP server stopped.")

    async def _call_tool(self, name: str, arguments: dict) -> Any:
        """Call a specific tool on the MCP server, auto-starting if needed."""
        if self.session is None:
            await self.start()
            
        try:
            logger.info(f"Calling MCP Playwright tool '{name}' with args: {arguments}")
            result = await self.session.call_tool(name, arguments)
            return result
        except Exception as e:
            logger.error(f"Error calling MCP tool '{name}': {e}")
            raise

    # ─── API Methods (Async) ──────────────────────────────────────────────────

    async def navigate_async(self, url: str) -> dict:
        if not url.startswith("http"):
            url = f"https://{url}"
        res = await self._call_tool("browser_navigate", {"url": url})
        return {"status": "success", "detail": f"Navigated to {url}", "result": str(res)}

    async def click_async(self, selector_or_text: str) -> dict:
        target = selector_or_text
        if not any(char in target for char in ("#", ".", "[", "]", "=", "ref=")):
            target = f"text={selector_or_text}"
            
        res = await self._call_tool("browser_click", {"target": target})
        return {"status": "success", "detail": f"Clicked element '{target}'", "result": str(res)}

    async def type_text_async(self, selector: str, text: str) -> dict:
        target = selector
        if not any(char in target for char in ("#", ".", "[", "]", "=", "ref=")):
            target = f"text={selector}"
        res = await self._call_tool("browser_type", {"target": target, "text": text})
        return {"status": "success", "detail": f"Typed '{text}' into '{target}'", "result": str(res)}

    async def get_page_content_async(self) -> str:
        try:
            res = await self._call_tool("browser_snapshot", {})
            if hasattr(res, "content") and res.content:
                text = "".join([c.text for c in res.content if hasattr(c, "text")])
                if text.strip():
                    return text
        except Exception as e:
            logger.error(f"Error getting browser snapshot: {e}")
            
        # Fallback to document.body.innerText evaluation
        try:
            res = await self._call_tool("browser_evaluate", {"function": "() => document.body.innerText"})
            if hasattr(res, "content") and res.content:
                text = "".join([c.text for c in res.content if hasattr(c, "text")])
                return text
        except Exception as e:
            logger.error(f"Error evaluating body.innerText: {e}")
        return ""

    async def screenshot_async(self) -> str:
        """Captures page screenshot, saves to file, returns base64 representation."""
        temp_filename = "screenshot_temp.png"
        try:
            await self._call_tool("browser_take_screenshot", {"type": "png", "filename": temp_filename})
            screenshot_path = os.path.abspath(settings.SCREENSHOT_PATH)
            
            if os.path.exists(temp_filename):
                with open(temp_filename, "rb") as f:
                    img_data = f.read()
                with open(screenshot_path, "wb") as f:
                    f.write(img_data)
                try:
                    os.remove(temp_filename)
                except Exception:
                    pass
                logger.info(f"Screenshot saved to {screenshot_path}")
                return base64.b64encode(img_data).decode("utf-8")
        except Exception as e:
            logger.error(f"Failed to capture screenshot: {e}")
            
        return ""

    async def wait_for_async(self, selector: str, timeout: int = 5000) -> dict:
        if not any(char in selector for char in ("#", ".", "[", "]", "=", "ref=")):
            try:
                res = await self._call_tool("browser_wait_for", {"text": selector, "time": timeout / 1000})
                return {"status": "success", "detail": f"Waited for text '{selector}'"}
            except Exception as e:
                return {"status": "failed", "error": str(e)}
        
        import time
        start_time = time.time()
        while time.time() - start_time < (timeout / 1000):
            try:
                js_func = f"() => document.querySelector('{selector}') !== null"
                if selector.startswith("ref="):
                    js_func = f"() => document.querySelector('[data-mcp-ref=\"{selector[4:]}\"]') !== null"
                
                res = await self._call_tool("browser_evaluate", {"function": js_func})
                if hasattr(res, "content") and res.content:
                    text_val = res.content[0].text
                    if "true" in text_val.lower():
                        return {"status": "success", "detail": f"Selector '{selector}' is now loaded."}
            except Exception:
                pass
            await asyncio.sleep(0.5)
            
        return {"status": "failed", "error": f"Timeout waiting for selector: {selector}"}

    async def find_and_click_async(self, description: str, timeout: int = 8000) -> dict:
        """Uses LLM Vision to locate element matching description, and click it with a timeout fallback."""
        # Check known selectors first — instant, no vision needed
        for phrase, selector in KNOWN_SELECTORS.items():
            if phrase in description.lower() and selector:
                logger.info(f"Using known selector '{selector}' for description '{description}'")
                try:
                    res = await self.click_async(selector)
                    if res.get("status") == "success":
                        return res
                except Exception as e:
                    logger.warning(f"Failed to click known selector '{selector}': {e}")

        try:
            # Wrap the entire operation in a timeout block
            async with asyncio.timeout(timeout / 1000.0):
                # Try clicking directly first if the description might be a direct selector/text
                try:
                    res = await self.click_async(description)
                    if res.get("status") == "success":
                        return res
                except Exception:
                    pass

                # If direct click fails, use LLM Vision to resolve target selector from screenshot
                b64_image = await self.screenshot_async()
                if not b64_image:
                    return {"status": "failed", "error": "Could not take screenshot"}
                    
                visible_text = await self.get_page_content_async()
                
                prompt = f"""
                You are an assistant helping locate a click target on a webpage screenshot.
                
                DESCRIPTION OF TARGET: {description}
                
                VISIBLE PAGE TEXT CONTEXT:
                {visible_text[:2000]}
                
                TASK:
                Look at the page context and the screenshot. Find the most likely CSS selector, text selector (e.g. 'text=Submit' or 'button#submit') or ref ID (e.g., 'ref=e4') to click the element matching the description.
                
                Return ONLY a JSON object:
                {{"selector": "<best playwright selector>"}}
                
                For example:
                {{"selector": "a:has-text('Sign In')"}} or {{"selector": "input[name='q']"}} or {{"selector": "ref=e4"}}
                """
                
                from jarvis.providers.llm.openrouter_provider import OpenRouterProvider
                llm = OpenRouterProvider()
                llm.initialize()
                
                screenshot_path = os.path.abspath(settings.SCREENSHOT_PATH)
                response = llm.query(prompt, image_path=screenshot_path)
                response_text = response.get("response", "{}")
                
                try:
                    import json
                    clean_text = response_text.replace("```json", "").replace("```", "").strip()
                    data = json.loads(clean_text)
                    selector = data.get("selector")
                    if selector:
                        logger.info(f"LLM Vision resolved '{description}' to selector '{selector}'")
                        return await self.click_async(selector)
                except Exception as e:
                    logger.error(f"Failed to parse LLM selector for vision click: {e} | response: {response_text}")
                
                return {"status": "failed", "error": f"Could not find element: {description}"}
        except TimeoutError:
            logger.warning(f"Timeout of {timeout}ms exceeded in find_and_click_async for description: {description}")
            return {"status": "failed", "error": f"Timeout searching for element matching: {description}"}
        except Exception as e:
            logger.error(f"Error in find_and_click_async: {e}")
            return {"status": "failed", "error": str(e)}

    # ─── Sync Wrapper Methods ─────────────────────────────────────────────────

    def navigate(self, url: str) -> dict:
        return run_async(self.navigate_async(url))

    def click(self, selector_or_text: str) -> dict:
        return run_async(self.click_async(selector_or_text))

    def type_text(self, selector: str, text: str) -> dict:
        return run_async(self.type_text_async(selector, text))

    def get_page_content(self) -> str:
        return run_async(self.get_page_content_async())

    def screenshot(self) -> str:
        return run_async(self.screenshot_async())

    def wait_for(self, selector: str, timeout: int = 5000) -> dict:
        return run_async(self.wait_for_async(selector, timeout))

    def find_and_click(self, description: str, timeout: int = 8000) -> dict:
        return run_async(self.find_and_click_async(description, timeout))

