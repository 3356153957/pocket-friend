import { useState } from "react";

import { PocketFriendPrototype, type PrototypeRoute } from "./src/prototype/PocketFriendPrototype.tsx";

export default function App() {
  const [route, setRoute] = useState<PrototypeRoute>("island");

  return <PocketFriendPrototype route={route} onNavigate={setRoute} />;
}
