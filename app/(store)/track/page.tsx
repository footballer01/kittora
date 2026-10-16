import type { Metadata } from "next";
import { TrackView } from "@/components/store/track-view";

export const metadata: Metadata = {
  title: "Track your order",
  description: "Check your order status with your order number and mobile number.",
  alternates: { canonical: "/track" },
};

export default function TrackPage() {
  return <TrackView />;
}
