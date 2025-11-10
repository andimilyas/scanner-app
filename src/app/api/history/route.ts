import { NextResponse } from "next/server";
import { getSimartDB } from "@/app/lib/db";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userNoAbsen = searchParams.get("user");
    const limit = parseInt(searchParams.get("limit") || "20");
    
    if (!userNoAbsen) {
      return NextResponse.json({ 
        success: false, 
        error: "User tidak ditemukan." 
      }, { status: 400 });
    }

    const pool = await getSimartDB();

    // Query untuk ambil history validasi dan dispensing
    const result = await pool.request()
      .input("user", userNoAbsen)
      .input("limit", limit)
      .query(`
        SELECT TOP (@limit)
          CNOTRAN as code,
          valid_kemasan_at,
          valid_kemasan_by,
          CJAM_OUT,
          user_out
        FROM SIMARTDB.dbo.OUTH
        WHERE 
          (valid_kemasan_by = @user OR user_out = @user)
          AND (valid_kemasan_at IS NOT NULL OR (CJAM_OUT IS NOT NULL AND CJAM_OUT != ''))
        ORDER BY 
          CASE 
            WHEN valid_kemasan_at IS NOT NULL THEN valid_kemasan_at
            ELSE GETDATE()
          END DESC
      `);

    const history = result.recordset.map((record) => {
      const items = [];
      
      // Add validation entry if exists for this user
      if (record.valid_kemasan_at && record.valid_kemasan_by === userNoAbsen) {
        try {
          const validDate = new Date(record.valid_kemasan_at);
          if (!isNaN(validDate.getTime())) {
            items.push({
              id: `${record.code}-validation-${validDate.getTime()}`,
              code: record.code,
              mode: "validation" as const,
              timestamp: validDate.toISOString(),
              user: record.valid_kemasan_by,
            });
          }
        } catch (e) {
          console.error("Invalid validation date:", record.valid_kemasan_at, e);
        }
      }
      
      // Add dispensing entry if exists for this user
      // CJAM_OUT is VARCHAR time (HH:mm:ss), combine with a base date
      if (record.CJAM_OUT && record.user_out === userNoAbsen) {
        try {
          const timeStr = String(record.CJAM_OUT).trim();
          const match = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.exec(timeStr);

          // Determine base date: prefer valid_kemasan_at, fallback to today
          let baseDate = new Date();
          if (record.valid_kemasan_at) {
            const vd = new Date(record.valid_kemasan_at);
            if (!isNaN(vd.getTime())) {
              baseDate = vd;
            }
          }

          let dispensingDate: Date | null = null;
          if (match) {
            const [h, m, s] = match[0].split(":").map((v) => parseInt(v, 10));
            const combined = new Date(baseDate);
            combined.setHours(h, m, s, 0);
            dispensingDate = combined;
          } else {
            // Fallback: in case legacy CJAM_OUT stored a full datetime string
            const fallback = new Date(timeStr);
            if (!isNaN(fallback.getTime())) {
              dispensingDate = fallback;
            }
          }

          if (dispensingDate) {
            items.push({
              id: `${record.code}-dispensing-${dispensingDate.getTime()}`,
              code: record.code,
              mode: "dispensing" as const,
              timestamp: dispensingDate.toISOString(),
              user: record.user_out,
            });
          } else {
            console.warn("Unable to parse CJAM_OUT time:", record.CJAM_OUT);
          }
        } catch (e) {
          console.error("Invalid dispensing date:", record.CJAM_OUT, e);
        }
      }
      
      return items;
    }).flat();

    // Sort by timestamp descending
    history.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ 
      success: true, 
      data: history 
    });

  } catch (err: unknown) {
    console.error("History API Error:", err);
    
    let errorMessage = "Terjadi kesalahan saat mengambil riwayat.";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    
    return NextResponse.json({ 
      success: false, 
      error: errorMessage 
    }, { status: 500 });
  }
}