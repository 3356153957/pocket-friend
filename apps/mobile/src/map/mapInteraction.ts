export interface MarkerDomClick {
  detail: number;
  stopPropagation: () => void;
}

export interface MarkerSelectionHandlers {
  onDomClick: (event: MarkerDomClick) => void;
  onMarkerClick: () => void;
}

export function createMarkerSelectionHandlers(
  playerId: string,
  onSelectPlayer: (playerId: string) => void,
): MarkerSelectionHandlers {
  const selectPlayer = () => onSelectPlayer(playerId);

  return {
    onMarkerClick: selectPlayer,
    onDomClick: (event) => {
      if (event.detail !== 0) {
        return;
      }

      event.stopPropagation();
      selectPlayer();
    },
  };
}
