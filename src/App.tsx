import React, { useEffect } from 'react';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { useColorStore } from './store/useColorStore';
import { useWorkspaceStore } from './store/useWorkspaceStore';

export const App: React.FC = () => {
  useEffect(() => {
    useColorStore.getState().hydrate();
    useWorkspaceStore.getState().hydrate();
  }, []);

  return <WorkspaceLayout />;
};

export default App;
