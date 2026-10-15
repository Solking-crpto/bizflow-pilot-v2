import React from "react";
import type { Metadata } from "next";
import { PilotBusinessesClient } from "@/components/settings/PilotBusinessesClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pilot Businesses Admin — Multi-Tenant Enterprise AP | BizFlow Pilot V2",
  description: "Manage pilot organizations, verifiable proof links, and public directory consent.",
};

export default function PilotBusinessesPage() {
  return <PilotBusinessesClient />;
}
