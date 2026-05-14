import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string; serviceId: string } }
) {
  const { provider, serviceId } = params

  try {
    const filePath = path.join(process.cwd(), 'config', provider, `${serviceId}.json`)
    const fileContent = await fs.readFile(filePath, 'utf8')
    const config = JSON.parse(fileContent)

    return NextResponse.json(config)
  } catch (error) {
    console.warn(`Failed to load config for ${provider}/${serviceId}:`, error)
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }
}


