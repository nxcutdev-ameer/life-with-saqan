import React from 'react';

export type EngagementActions = {
  onShare?: (id: string) => void;
  onToggleLike?: (id: string) => void;
  onToggleSave?: (id: string) => void;
  onOpenComments?: (id: string) => void;
};

const EngagementActionsContext = React.createContext<EngagementActions>({});

export function EngagementActionsProvider({
  value,
  children,
}: {
  value: EngagementActions;
  children: React.ReactNode;
}) {
  return <EngagementActionsContext.Provider value={value}>{children}</EngagementActionsContext.Provider>;
}

export function useEngagementActions() {
  return React.useContext(EngagementActionsContext);
}
