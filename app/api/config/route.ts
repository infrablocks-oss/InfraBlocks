import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

// Static configuration for available providers and services
const AVAILABLE_PROVIDERS = ['aws', 'azure', 'gcp'] as const

const PROVIDER_SERVICES: Record<string, string[]> = {
  aws: [
    'api_gateway',
    'cloudwatch',
    'cognito',
    'dynamodb',
    'ec2',
    'fargate',
    'lambda',
    'rds',
    's3',
    'secrets_manager',
    'sqs',
    'step_functions',
    'vpc'
  ],
  azure: ['vm'],
  gcp: ['compute']
}

// GET /api/config - Load all configs
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const provider = url.searchParams.get('provider')
  const serviceId = url.searchParams.get('serviceId')

  try {
    // If specific provider and service requested
    if (provider && serviceId) {
      const config = await loadServiceConfig(provider, serviceId)
      if (!config) {
        return NextResponse.json({ error: 'Config not found' }, { status: 404 })
      }
      return NextResponse.json(config)
    }

    // Load all configs
    const result: Record<string, Record<string, any>> = {}

    for (const provider of AVAILABLE_PROVIDERS) {
      result[provider] = {}
      const services = PROVIDER_SERVICES[provider] || []

      for (const serviceId of services) {
        const config = await loadServiceConfig(provider, serviceId)
        if (config) {
          result[provider][serviceId] = config
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to load configs:', error)
    return NextResponse.json({ error: 'Failed to load configs' }, { status: 500 })
  }
}

async function loadServiceConfig(provider: string, serviceId: string) {
  try {
    const filePath = path.join(process.cwd(), 'config', provider, `${serviceId}.json`)
    const fileContent = await fs.readFile(filePath, 'utf8')
    return JSON.parse(fileContent)
  } catch (error) {
    console.warn(`Failed to load config for ${provider}/${serviceId}:`, error)
    return null
  }
}


