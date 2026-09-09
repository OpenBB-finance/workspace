// @ts-expect-error - ignored for now
import { createClient } from "@liveblocks/client";
// @ts-expect-error - ignored for now
import { createRoomContext } from "@liveblocks/react";

const client = createClient({
  publicApiKey: "",
});
type Presence = {
  cursor: { x: number; y: number } | null;
};

export const { RoomProvider, useOthers, useUpdateMyPresence } =
  createRoomContext<Presence>(client);
