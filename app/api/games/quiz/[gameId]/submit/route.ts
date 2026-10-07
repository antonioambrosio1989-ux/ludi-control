import {
  NextResponse,
} from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Endpoint Quiz legacy disattivato. Usa il runtime Weekly Challenge.",
    },
    {
      status:
        410,
    },
  );
}
