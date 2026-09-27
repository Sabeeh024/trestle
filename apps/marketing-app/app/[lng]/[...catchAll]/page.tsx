import { notFound } from "next/navigation";

// Any path under [lng] that doesn't match a real page lands here. Without
// this catch-all, an unmatched URL never enters the [lng] tree at all, so
// Next serves its generic global 404 instead of our translated not-found.tsx.
export default function CatchAll(): never {
  notFound();
}
