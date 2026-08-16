"use client";

import Home from "../page";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return <Home requestedGameId={params.gameId} />;
}
