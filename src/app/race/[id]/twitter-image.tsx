import { ogAlt, ogContentType, ogRuntime, ogSize, renderRaceResultImage } from "./og-card";

export const size = ogSize;
export const contentType = ogContentType;
export const runtime = ogRuntime;
export const alt = ogAlt;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return renderRaceResultImage(id);
}
