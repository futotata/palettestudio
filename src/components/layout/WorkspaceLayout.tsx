import React from 'react';
import { PaintViewport } from '../canvas/PaintViewport';
import { LeftThumbBar } from './LeftThumbBar';
import { RightDock } from './RightDock';
import { TopMenuBar } from './TopMenuBar';

export const WorkspaceLayout: React.FC = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg-app)',
      }}
    >
      <TopMenuBar />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
        }}
      >
        <LeftThumbBar />
        <PaintViewport />
        <RightDock />
      </div>
    </div>
  );
};
