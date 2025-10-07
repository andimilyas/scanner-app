import { NextResponse } from "next/server";
import { getUserDB } from "@/app/lib/db";
import bcrypt from "bcryptjs";
import type { NextRequest } from "next/server";

// Rate limiting store (in production, use Redis or database)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

function sanitizeInput(input: string): string {
  return input.replace(/[<>\"'&]/g, '').trim();
}

function isRateLimited(ip: string): boolean {
  const attempts = loginAttempts.get(ip);
  if (!attempts) return false;
  
  const now = Date.now();
  if (now - attempts.lastAttempt > LOCKOUT_TIME) {
    loginAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_ATTEMPTS;
}

function recordLoginAttempt(ip: string, success: boolean): void {
  const now = Date.now();
  const attempts = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  
  if (success) {
    loginAttempts.delete(ip);
  } else {
    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(ip, attempts);
  }
}

export async function POST(req: NextRequest) {
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  
  try {
    // Check rate limiting
    if (isRateLimited(clientIP)) {
      return NextResponse.json({ 
        success: false, 
        message: "Terlalu banyak percobaan login. Silakan coba lagi nanti." 
      }, { status: 429 });
    }

    const body = await req.json();
    const { no_absen, password }: { no_absen: string; password: string } = body;
    
    // Input validation and sanitization
    if (!no_absen || !password) {
      return NextResponse.json({ success: false, message: "No Absen dan Password harus diisi" });
    }

    // Sanitize inputs
    const sanitizedNoAbsen = sanitizeInput(no_absen);
    const sanitizedPassword = sanitizeInput(password);

    // Validate no_absen format (should be 4 digits)
    if (!/^\d{4}$/.test(sanitizedNoAbsen)) {
      return NextResponse.json({ success: false, message: "Format No Absen tidak valid" });
    }

    // Validate password length
    if (sanitizedPassword.length < 4 || sanitizedPassword.length > 50) {
      return NextResponse.json({ success: false, message: "Password tidak valid" });
    }

    const pool = await getUserDB();

    // Get user by no_absen only (not comparing password yet)
    const result = await pool.request()
      .input("no_absen", sanitizedNoAbsen)
      .query(`
        SELECT * FROM users 
        WHERE no_absen = @no_absen
      `);

    if (result.recordset.length === 0) {
      recordLoginAttempt(clientIP, false);
      return NextResponse.json({ success: false, message: "No Absen tidak ditemukan" });
    }

    const user = result.recordset[0];
    const hashedPassword = user.password;

    // Compare password with hashed password
    const isPasswordValid = await bcrypt.compare(sanitizedPassword, hashedPassword);

    if (isPasswordValid) {
      recordLoginAttempt(clientIP, true);
      
      // Remove password from response for security
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ 
        success: true, 
        user: userWithoutPassword 
      });
    } else {
      recordLoginAttempt(clientIP, false);
      return NextResponse.json({ success: false, message: "Password salah" });
    }
  } catch (error) {
    // Log error without sensitive data
    console.error(`Login API Error - IP: ${clientIP} - Time: ${new Date().toISOString()} - Error:`, error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ 
      success: false, 
      message: "Terjadi kesalahan pada server" 
    }, { status: 500 });
  }
}
