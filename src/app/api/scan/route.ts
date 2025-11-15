import { NextResponse } from "next/server";
import { getSimartDB } from "@/app/lib/db";
import type { NextRequest } from "next/server";

interface ScanRequestBody {
  code: string;
  mode: string;
  user: string;
}

export async function POST(req: NextRequest) {
  let pool;
  
  try {
    const body: ScanRequestBody = await req.json();
    const { code, mode, user } = body;

    if (!code || !mode || !user) {
      return NextResponse.json({ 
        success: false, 
        error: "Data tidak lengkap." 
      });
    }

    pool = await getSimartDB();
    const trimmedCode = code.trim();

    // Start transaction untuk data consistency
    const transaction = pool.transaction();
    
    try {
      await transaction.begin();

      // Check if record exists
      const checkResult = await transaction.request()
        .input("code", trimmedCode)
        .query(`
          SELECT 
            valid_kemasan_at, 
            valid_kemasan_by, 
            CJAM_OUT, 
            user_out
          FROM SIMARTDB.dbo.OUTH WITH (UPDLOCK, HOLDLOCK)
          WHERE CNOTRAN = @code
        `);

      const record = checkResult.recordset[0];
      
      if (!record) {
        await transaction.rollback();
        return NextResponse.json({ 
          success: false, 
          error: "Kode tidak ditemukan di database." 
        });
      }

      // Validation mode checks
      if (mode === "validation") {
        if (record.valid_kemasan_at) {
          await transaction.rollback();
          return NextResponse.json({
            success: false,
            error: "Barcode ini sudah pernah divalidasi sebelumnya.",
          });
        }

        // Update validation
        await transaction.request()
          .input("no_absen", user)
          .input("code", trimmedCode)
          .query(`
            UPDATE SIMARTDB.dbo.OUTH
            SET valid_kemasan_at = GETDATE(),
                valid_kemasan_by = @no_absen
            WHERE CNOTRAN = @code
          `);
      } 
      // Dispensing mode checks
      else if (mode === "dispensing") {
        // Check if validation is done first
        if (!record.valid_kemasan_at) {
          await transaction.rollback();
          return NextResponse.json({
            success: false,
            error: "Barcode belum divalidasi. Lakukan validasi kemasan terlebih dahulu.",
          });
        }

        if (record.CJAM_OUT) {
          await transaction.rollback();
          return NextResponse.json({
            success: false,
            error: "Barcode ini sudah pernah digunakan untuk pemberian obat.",
          });
        }

        // Update dispensing
        await transaction.request()
          .input("no_absen", user)
          .input("code", trimmedCode)
          .query(`
            UPDATE SIMARTDB.dbo.OUTH
            SET CJAM_OUT = CONVERT(VARCHAR(8), GETDATE(), 108),
                user_out = @no_absen
            WHERE CNOTRAN = @code
          `);
      } else {
        await transaction.rollback();
        return NextResponse.json({ 
          success: false, 
          error: "Mode tidak valid." 
        });
      }

      // Commit transaction
      await transaction.commit();

      return NextResponse.json({ 
        success: true,
        message: mode === "validation" 
          ? "Validasi kemasan berhasil." 
          : "Pemberian obat berhasil."
      });

    } catch (transactionError) {
      // Rollback on any error
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
      throw transactionError;
    }

  } catch (err: unknown) {
    console.error("DB Error:", err);
    
    let errorMessage = "Terjadi kesalahan pada server.";
    
    if (err instanceof Error) {
      // Handle specific SQL errors
      if (err.message.includes("truncated")) {
        errorMessage = "Kode terlalu panjang atau format tidak sesuai.";
      } else if (err.message.includes("timeout")) {
        errorMessage = "Koneksi database timeout. Silakan coba lagi.";
      } else if (err.message.includes("deadlock")) {
        errorMessage = "Terjadi konflik data. Silakan coba lagi.";
      } else {
        errorMessage = err.message;
      }
    } else if (typeof err === "string") {
      errorMessage = err;
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}