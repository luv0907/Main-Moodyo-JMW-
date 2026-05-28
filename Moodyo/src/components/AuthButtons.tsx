'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, Library, LogOut, LogIn, Plus, Heart, Camera } from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarFooter,
  SidebarHeader,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { ScrollArea } from './ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { useUserPreferences } from '@/hooks/use-user-preferences';
import { useSongs } from '@/hooks/use-songs';
import { motion } from 'framer-motion';

const MotionSidebarMenuButton = motion(SidebarMenuButton);

export default function AuthButtons({ onNavigate, onScanClick }: { onNavigate: (page: string) => void, onScanClick?: () => void }) {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { likedSongIds } = useUserPreferences(user?.uid);
  const { songs } = useSongs();

  const likedSongs = songs.filter(song => likedSongIds.includes(song.id!));

  const handleSignOut = async () => {
    await auth.signOut();
    router.push('/login');
  };

  if (isUserLoading) {
    return <div className="p-4">Loading...</div>;
  }

  const motionProps = {
    whileHover: { scale: 1.05 },
    whileTap: { scale: 0.95 },
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  };

  return (
    <>
      <SidebarHeader>
        <div onClick={() => router.push('/')} className="logo hidden group-data-[state=expanded]:block cursor-pointer">
          MoodyO
        </div>
        <SidebarTrigger />
      </SidebarHeader>

      <SidebarGroup>
        <SidebarMenu>
          <SidebarMenuItem>
            <MotionSidebarMenuButton
              isActive={pathname === '/'}
              onClick={() => router.push('/')}
              {...motionProps}
            >
              <Home />
              <span className="group-data-[state=collapsed]:hidden">Home</span>
            </MotionSidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <MotionSidebarMenuButton
              isActive={pathname === '/search'}
              onClick={() => router.push('/search')}
              {...motionProps}
            >
              <Search />
              <span className="group-data-[state=collapsed]:hidden">Search</span>
            </MotionSidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <MotionSidebarMenuButton
              isActive={false}
              onClick={onScanClick}
              className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
              {...motionProps}
            >
              <Camera />
              <span className="group-data-[state=collapsed]:hidden font-bold">Scan Emotion</span>
            </MotionSidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      {user && (
        <SidebarGroup className="flex-grow flex flex-col min-h-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <MotionSidebarMenuButton
                onClick={() => router.push('/library')}
                isActive={pathname === '/library'}
                {...motionProps}
              >
                <Library />
                <span className="group-data-[state=collapsed]:hidden">Your Library</span>
                <Plus size={18} className="ml-auto opacity-70 hover:opacity-100 group-data-[state=collapsed]:hidden" />
              </MotionSidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <MotionSidebarMenuButton
                onClick={() => router.push('/library')}
                {...motionProps}
              >
                <div className="liked-songs-icon"><Heart /></div>
                <span className="group-data-[state=collapsed]:hidden">Liked Songs</span>
              </MotionSidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <ScrollArea className="flex-grow mt-4">
            {likedSongs.length > 0 && (
              <SidebarMenu>
                {likedSongs.slice(0, 10).map(song => (
                  <SidebarMenuItem key={song.id}>
                    <SidebarMenuButton className="h-auto py-1">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={song.cover} alt={song.title} />
                        <AvatarFallback>{song.title.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col items-start group-data-[state=collapsed]:hidden">
                        <span>{song.title}</span>
                        <small className="text-xs text-muted-foreground">{song.artist}</small>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            )}
          </ScrollArea>
        </SidebarGroup>
      )}


      <SidebarFooter>
        {user ? (
          <SidebarMenuButton onClick={handleSignOut}>
            <LogOut />
            <span className="group-data-[state=collapsed]:hidden">Sign Out</span>
          </SidebarMenuButton>
        ) : (
          <SidebarMenuButton onClick={() => router.push('/login')}>
            <LogIn />
            <span className="group-data-[state=collapsed]:hidden">Sign In</span>
          </SidebarMenuButton>
        )}
      </SidebarFooter>
    </>
  );
}
