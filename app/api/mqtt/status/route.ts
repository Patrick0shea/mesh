import { NextResponse } from "next/server";
import { getMqttStatus } from "@/lib/mqtt-client";

export async function GET() {
  return NextResponse.json({ status: getMqttStatus() });
}