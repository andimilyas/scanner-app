import { NextResponse } from "next/server";
import { getSimartDB } from "@/app/lib/db";
import type { NextRequest } from "next/server";

interface ScanRequestBody {
  code: string;
  mode: string;
  user: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: ScanRequestBody = await req.json();
    const { code, mode, user } = body;

    const pool = await getSimartDB();
    const trimmedCode = code.trim();

    const checkResult = await pool.request()
      .input("code", trimmedCode)
      .query(`
        SELECT valid_kemasan_at, valid_kemasan_by, CJAM_OUT, user_out
        FROM SIMARTDB.dbo.OUTH
        WHERE CNOTRAN = @code
      `);

    const record = checkResult.recordset[0];
    if (!record) {
      return NextResponse.json({ success: false, error: "Kode tidak ditemukan di database." });
    }

    if (mode === "validation" && record.valid_kemasan_at) {
      return NextResponse.json({
        success: false,
        error: "Barcode ini sudah pernah divalidasi sebelumnya.",
      });
    }

    if (mode === "dispensing" && record.CJAM_OUT) {
      return NextResponse.json({
        success: false,
        error: "Barcode ini sudah pernah digunakan untuk pemberian obat.",
      });
    }

    if (mode === "validation") {
      await pool.request()
        .input("no_absen", user)
        .input("code", trimmedCode)
        .query(`
          UPDATE SIMARTDB.dbo.OUTH
          SET valid_kemasan_at = GETDATE(),
              valid_kemasan_by = @no_absen
          WHERE CNOTRAN = @code
        `);
    } else if (mode === "dispensing") {
      await pool.request()
        .input("no_absen", user)
        .input("code", trimmedCode)
        .query(`
          UPDATE SIMARTDB.dbo.OUTH
          SET CJAM_OUT = GETDATE(),
              user_out = @no_absen
          WHERE CNOTRAN = @code
        `);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("DB Error:", err);
    let errorMessage = "Terjadi kesalahan pada server.";
    if (err instanceof Error) {
      errorMessage = err.message;
    } else if (typeof err === "string") {
      errorMessage = err;
    }
    return NextResponse.json({ success: false, error: errorMessage });
  }
}
