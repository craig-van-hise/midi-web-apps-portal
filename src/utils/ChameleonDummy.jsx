import React, { useEffect, useState } from 'react';

export function ChameleonDummy() {
  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window !== window.parent);
  }, []);

  return (
    <div data-testid="chameleon-dummy" style={{ display: 'none' }}>
      <span data-testid="is-embedded">{String(isEmbedded)}</span>
    </div>
  );
}
