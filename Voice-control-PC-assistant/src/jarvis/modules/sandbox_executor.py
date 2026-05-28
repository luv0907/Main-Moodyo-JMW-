import sys
import subprocess
import tempfile
import os
from jarvis.utils.logger import logger

class SandboxExecutor:
    """
    Executes Python code in a safe(ish) subprocess and returns output.
    This allows JARVIS to solve complex math, data, or logic problems.
    """

    def run_python(self, code: str) -> dict:
        """
        Runs the provided code string in a separate Python process.
        Returns: {"status": "success/error", "output": "...", "error": "..."}
        """
        logger.info("Executing code in sandbox...")
        
        # We use a temporary file to hold the code
        with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as tmp:
            tmp.write(code.encode("utf-8"))
            tmp_path = tmp.name

        try:
            # Run the code using the current python executable
            result = subprocess.run(
                [sys.executable, tmp_path],
                capture_output=True,
                text=True,
                timeout=30  # Safety timeout
            )
            
            if result.returncode == 0:
                return {
                    "status": "success",
                    "output": result.stdout.strip(),
                    "error": result.stderr.strip()
                }
            else:
                return {
                    "status": "error",
                    "output": result.stdout.strip(),
                    "error": result.stderr.strip()
                }
        except subprocess.TimeoutExpired:
            return {"status": "error", "error": "Execution timed out (30s limit)"}
        except Exception as e:
            return {"status": "error", "error": str(e)}
        finally:
            # Cleanup
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
