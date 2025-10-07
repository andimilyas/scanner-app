import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    
    // Log logout event
    console.log(`User logout - IP: ${clientIP} - Time: ${new Date().toISOString()}`);
    
    return NextResponse.json({ 
      success: true, 
      message: "Logout berhasil" 
    });
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server" 
    }, { status: 500 });
  }
}
