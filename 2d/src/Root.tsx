import React from 'react';
import { Composition } from 'remotion';
import './lib/fonts';
import { Episode } from './Episode';
import { Bible, FPS, H, Timeline, W } from './types';

export const Root: React.FC = () => (
  <Composition
    id="Episode"
    component={Episode as React.FC<any>}
    width={W}
    height={H}
    fps={FPS}
    durationInFrames={FPS * 10}
    defaultProps={{ timeline: null as unknown as Timeline, bible: null as unknown as Bible }}
    calculateMetadata={({ props }) => ({ durationInFrames: (props as any).timeline?.totalFrames ?? FPS * 10 })}
  />
);
