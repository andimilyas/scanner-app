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
        error: "Data tidak lengkap.",
      });
    }

    pool = await getSimartDB();
    const trimmedCode = code.trim();

    const transaction = pool.transaction();

    try {
      await transaction.begin();

      // =========================================================
      // CHECK DATA OUTH
      // =========================================================
      const checkResult = await transaction
        .request()
        .input("code", trimmedCode)
        .query(`
          SELECT
            CNOTRAN,
            RESEP_REQ_H_ID,
            NO_ANTRIAN,
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
          error: "Kode tidak ditemukan di database.",
        });
      }

      // =========================================================
      // VALIDATION
      // =========================================================
      if (mode === "validation") {
        // Sudah pernah validasi
        if (record.valid_kemasan_at) {
          await transaction.rollback();

          return NextResponse.json({
            success: false,
            error: "Barcode ini sudah pernah divalidasi sebelumnya.",
          });
        }

        // -------------------------------------------------------
        // 1. UPDATE OUTH
        // -------------------------------------------------------
        await transaction
          .request()
          .input("no_absen", user)
          .input("code", trimmedCode)
          .query(`
            UPDATE SIMARTDB.dbo.OUTH
            SET
              valid_kemasan_at = GETDATE(),
              valid_kemasan_by = @no_absen
            WHERE CNOTRAN = @code
          `);

        // -------------------------------------------------------
        // 2. UPDATE RESEP_ANTRIAN_FARMASI
        //
        // Hanya dilakukan jika RESEP_REQ_H_ID tersedia.
        // Kalau NULL, proses OUTH tetap dianggap berhasil.
        // -------------------------------------------------------
        if (record.RESEP_REQ_H_ID) {
          const resepResult = await transaction
            .request()
            .input("resep_req_h_id", record.RESEP_REQ_H_ID)
            .query(`
              SELECT TOP 1
                RESEP_ANTRIAN_ID,
                RESEP_REQ_H_ID,
                TGL_KEMASAN,
                NO_ABSEN_KEMASAN
              FROM SIMRS_V2..RESEP_ANTRIAN_FARMASI WITH (UPDLOCK, HOLDLOCK)
              WHERE RESEP_REQ_H_ID = @resep_req_h_id
              ORDER BY TGL_KIRIM DESC
            `);

          const resep = resepResult.recordset[0];

          // Kalau data resep ditemukan, update.
          // Kalau tidak ditemukan, jangan menggagalkan update OUTH.
          if (resep) {
            await transaction
              .request()
              .input("no_absen", user)
              .input("resep_antrian_id", resep.RESEP_ANTRIAN_ID)
              .query(`
                UPDATE SIMRS_V2..RESEP_ANTRIAN_FARMASI
                SET
                  TGL_KEMASAN = GETDATE(),
                  NO_ABSEN_KEMASAN = @no_absen,
                  UPDATED_AT = GETDATE()
                WHERE RESEP_ANTRIAN_ID = @resep_antrian_id
              `);
          }
        }
      }

      // =========================================================
      // DISPENSING
      // =========================================================
      else if (mode === "dispensing") {
        // Belum validasi kemasan
        if (!record.valid_kemasan_at) {
          await transaction.rollback();

          return NextResponse.json({
            success: false,
            error:
              "Barcode belum divalidasi. Lakukan validasi kemasan terlebih dahulu.",
          });
        }

        // Sudah pernah dispensing
        if (record.CJAM_OUT) {
          await transaction.rollback();

          return NextResponse.json({
            success: false,
            error:
              "Barcode ini sudah pernah digunakan untuk pemberian obat.",
          });
        }

        // -------------------------------------------------------
        // 1. UPDATE OUTH
        // -------------------------------------------------------
        await transaction
          .request()
          .input("no_absen", user)
          .input("code", trimmedCode)
          .query(`
            UPDATE SIMARTDB.dbo.OUTH
            SET
              CJAM_OUT = CONVERT(VARCHAR(8), GETDATE(), 108),
              user_out = @no_absen
            WHERE CNOTRAN = @code
          `);

        // -------------------------------------------------------
        // 2. UPDATE RESEP_ANTRIAN_FARMASI
        // -------------------------------------------------------
        if (record.RESEP_REQ_H_ID) {
          const resepResult = await transaction
            .request()
            .input("resep_req_h_id", record.RESEP_REQ_H_ID)
            .query(`
              SELECT TOP 1
                RESEP_ANTRIAN_ID,
                RESEP_REQ_H_ID,
                TGL_PENYERAHAN,
                NO_ABSEN_PENYERAHAN
              FROM SIMRS_V2..RESEP_ANTRIAN_FARMASI WITH (UPDLOCK, HOLDLOCK)
              WHERE RESEP_REQ_H_ID = @resep_req_h_id
              ORDER BY TGL_KIRIM DESC
            `);

          const resep = resepResult.recordset[0];

          if (resep) {
            await transaction
              .request()
              .input("no_absen", user)
              .input("resep_antrian_id", resep.RESEP_ANTRIAN_ID)
              .query(`
                UPDATE SIMRS_V2..RESEP_ANTRIAN_FARMASI
                SET
                  TGL_PENYERAHAN = GETDATE(),
                  NO_ABSEN_PENYERAHAN = @no_absen,
                  UPDATED_AT = GETDATE()
                WHERE RESEP_ANTRIAN_ID = @resep_antrian_id
              `);
          }
        }
      }

      // =========================================================
      // INVALID MODE
      // =========================================================
      else {
        await transaction.rollback();

        return NextResponse.json({
          success: false,
          error: "Mode tidak valid.",
        });
      }

      // =========================================================
      // COMMIT
      // =========================================================
      await transaction.commit();

      return NextResponse.json({
        success: true,
        message:
          mode === "validation"
            ? "Validasi kemasan berhasil."
            : "Pemberian obat berhasil.",
      });
    } catch (transactionError) {
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
      const message = err.message.toLowerCase();

      if (message.includes("truncated")) {
        errorMessage = "Kode terlalu panjang atau format tidak sesuai.";
      } else if (message.includes("timeout")) {
        errorMessage =
          "Koneksi database timeout. Silakan coba lagi.";
      } else if (message.includes("deadlock")) {
        errorMessage =
          "Terjadi konflik data. Silakan coba lagi.";
      } else {
        errorMessage = err.message;
      }
    } else if (typeof err === "string") {
      errorMessage = err;
    }

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}