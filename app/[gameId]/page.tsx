"use client";

import Home from "../page";

export default function GamePage() {
  // Home also reads the current browser path. Keeping the route parameter out
  // of this client boundary makes direct links work whether the host supplies
  // dynamic route params during hydration or serves the app shell as a fallback.
  return <Home />;
}
