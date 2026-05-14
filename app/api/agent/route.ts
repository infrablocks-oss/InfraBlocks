import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

// Initialize OpenAI client server-side
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Agent function definitions
const agentFunctions = {
  createInfrastructure: {
    name: "create_infrastructure",
    description: "Create and deploy cloud infrastructure based on user requirements",
    parameters: {
      type: "object",
      properties: {
        infrastructureType: {
          type: "string",
          description: "Type of infrastructure to create (e.g., web-app, single-service, data-pipeline, api, microservices, etc.)"
        },
        requirements: {
          type: "string",
          description: "Detailed requirements and specifications for the infrastructure"
        }
      },
      required: ["infrastructureType", "requirements"]
    }
  },
  analyzeArchitecture: {
    name: "analyze_architecture", 
    description: "Analyze and provide insights on cloud architecture",
    parameters: {
      type: "object",
      properties: {
        analysisType: {
          type: "string",
          description: "Type of analysis to perform (e.g., performance, security, cost, scalability, general review)"
        },
        currentSetup: {
          type: "string",
          description: "Description of current architecture or specific areas to analyze"
        }
      },
      required: ["analysisType"]
    }
  },
  troubleshootIssues: {
    name: "troubleshoot_issues",
    description: "Help debug and resolve infrastructure problems",
    parameters: {
      type: "object",
      properties: {
        issueType: {
          type: "string", 
          description: "Type of issue being experienced (e.g., deployment, connectivity, performance, cost, configuration)"
        },
        errorDetails: {
          type: "string",
          description: "Specific error messages, symptoms, or problem description"
        }
      },
      required: ["issueType"]
    }
  },
  provideBestPractices: {
    name: "provide_best_practices",
    description: "Share relevant cloud architecture best practices and recommendations",
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "Best practice topic or area of interest (e.g., security, cost-optimization, high-availability, performance, monitoring)"
        },
        context: {
          type: "string",
          description: "Additional context about the user's situation or specific requirements"
        }
      },
      required: ["topic"]
    }
  }
}

// Available functions mapping
const functionMap: Record<string, Function> = {
  create_infrastructure: handleCreateInfrastructure,
  analyze_architecture: handleAnalyzeArchitecture,
  troubleshoot_issues: handleTroubleshootIssues,
  provide_best_practices: handleProvideBestPractices
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API Route: Received agent request')
    console.log('🔍 DEBUG: Request method:', request.method)
    console.log('🔍 DEBUG: Request headers:', Object.fromEntries(request.headers.entries()))

    const body = await request.json()
    console.log('🔍 DEBUG: Raw request body:', JSON.stringify(body, null, 2))

    const { message, conversationHistory, canvasContext } = body

    console.log('📝 API Route: Message:', message)
    console.log('📚 API Route: Conversation history length:', conversationHistory?.length || 0)
    console.log('🎨 API Route: Canvas context:', canvasContext)
    console.log('🔍 DEBUG: Conversation history:', JSON.stringify(conversationHistory, null, 2))

    if (!message) {
      console.error('❌ API Route: Message is required')
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const messages = [
      {
        role: "system",
        content: `You are an expert cloud infrastructure consultant and DevOps engineer. You help users with cloud infrastructure questions, architecture design, and deployment guidance.

CURRENT CANVAS STATE: ${canvasContext || 'No canvas context available'}

IMPORTANT: When users ask questions about services, architecture, costs, security, or performance, assume they are asking about their CURRENT infrastructure setup on the canvas unless they explicitly mention creating something new.

You should be conversational, helpful, and adaptable to user needs. Respond naturally to questions and only use functions when the user clearly wants to take action (create, build, deploy infrastructure).

CONVERSATION GUIDELINES:
- Be conversational and natural in your responses
- Answer questions directly without forcing structured outputs
- Only call functions when users explicitly want to create or modify infrastructure
- Feel free to discuss concepts, provide explanations, and have back-and-forth conversations
- Use functions as tools to help users, not as rigid requirements
- ALWAYS assume questions are about the current canvas infrastructure unless user says otherwise

WHEN TO USE FUNCTIONS:
- create_infrastructure: When users explicitly want to CREATE, BUILD, or ADD infrastructure to their canvas
- analyze_architecture: When users want a formal analysis of existing infrastructure  
- troubleshoot_issues: When users need help debugging specific problems
- provide_best_practices: When users ask for structured best practices guidance

WHEN TO RESPOND CONVERSATIONALLY:
- Questions about current infrastructure (assume this is the default)
- General questions about cloud concepts
- Explanations of how services work
- Discussions about architecture patterns
- Clarifying questions before taking action
- Follow-up questions after using functions

INFRASTRUCTURE CAPABILITIES:
InfraBlocks currently supports these core AWS services:
- DynamoDB (NoSQL database)
- S3 (object storage) 
- API Gateway (API management)
- SQS (message queuing)
- RDS (relational database)

Additional services are planned for future releases. You can discuss any cloud service or concept, but can only create the supported services on the canvas.

Be flexible and responsive to what the user actually needs rather than forcing them into predefined categories.`
      },
      ...(conversationHistory || []).slice(-10), // Keep last 10 messages for context
      {
        role: "user",
        content: message
      }
    ]

    console.log('🤖 API Route: Calling OpenAI API...')
    console.log('🔍 DEBUG: Messages being sent:', JSON.stringify(messages, null, 2))
    console.log('🔍 DEBUG: Functions available:', Object.keys(agentFunctions))

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: messages,
      tools: Object.values(agentFunctions).map(func => ({ type: "function", function: func })),
      tool_choice: "auto",
      max_tokens: 1500,
      temperature: 0.8
    })

    console.log('✅ API Route: OpenAI response received')
    console.log('🔍 DEBUG: Full OpenAI response:', JSON.stringify(response, null, 2))

    const choice = response.choices[0]
    const messageResponse = choice.message
    console.log('🎯 API Route: Response type:', messageResponse.tool_calls ? 'tool_calls' : 'text')
    console.log('🔍 DEBUG: Message response content:', messageResponse.content)
    console.log('🔍 DEBUG: Tool calls details:', messageResponse.tool_calls)

    // Check if the model wants to call a tool
    if (messageResponse.tool_calls && messageResponse.tool_calls.length > 0) {
      const toolCall = messageResponse.tool_calls[0]
      if (toolCall.type === 'function') {
        const functionName = toolCall.function.name
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}')
        console.log('🔧 API Route: Tool call:', functionName, functionArgs)
        console.log('🔍 DEBUG: Function args parsed:', functionArgs)

        // Call the appropriate handler function
        const handler = functionMap[functionName]
        if (handler) {
          console.log('⚙️ API Route: Executing handler:', functionName)
          console.log('🔍 DEBUG: Handler function found:', typeof handler)
          const result = await handler(functionArgs)
          console.log('🎉 API Route: Handler result:', JSON.stringify(result, null, 2))
          console.log('🔍 DEBUG: Returning handler result')
          return NextResponse.json(result)
        } else {
          console.error('❌ API Route: No handler found for:', functionName)
          console.log('🔍 DEBUG: Available handlers:', Object.keys(functionMap))
        }
      }
    }

    // Return regular response if no function call
    console.log('💬 API Route: Returning text response')
    const textResponse = {
      type: 'text',
      content: messageResponse.content || "I'm here to help with your cloud infrastructure needs. What would you like to work on?"
    }
    console.log('🔍 DEBUG: Text response:', JSON.stringify(textResponse, null, 2))
    return NextResponse.json(textResponse)
  } catch (error) {
    console.error('❌ OpenAI agent error:', error)
    console.log('🔍 DEBUG: Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.log('🔍 DEBUG: Error type:', typeof error)
    return NextResponse.json({
      error: 'Failed to process message',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Handler functions
async function handleCreateInfrastructure(args: any) {
  console.log('🔧 Handler: handleCreateInfrastructure called with args:', args)
  const { infrastructureType, requirements } = args
  console.log('🔍 DEBUG: Infrastructure type:', infrastructureType, 'Requirements:', requirements)

  // Normalize the infrastructure type for better handling
  const typeMapping = {
    "web-app": "Web Application",
    "web app": "Web Application", 
    "webapp": "Web Application",
    "web application": "Web Application",
    "full app": "Web Application",
    "complete app": "Web Application",
    "entire app": "Web Application",
    "full stack": "Web Application",
    "full infrastructure": "Web Application",
    "single-service": "Single Service",
    "single service": "Single Service",
    "api-gateway": "API Gateway",
    "api gateway": "API Gateway",
    "api": "API Gateway",
    "data-pipeline": "Data Pipeline",
    "data pipeline": "Data Pipeline",
    "etl": "Data Pipeline",
    "ml-infrastructure": "Machine Learning Infrastructure", 
    "ml": "Machine Learning Infrastructure",
    "microservices": "Microservices Architecture",
    "serverless": "Serverless Application"
  }

  const normalizedType = typeMapping[infrastructureType.toLowerCase() as keyof typeof typeMapping] || infrastructureType

  // Check if this is a single service request (not a full application)
  const singleServiceKeywords = ['add', 'create', 'dynamodb', 'dynamo', 's3', 'api gateway', 'sqs', 'rds', 'database', 'bucket', 'table', 'queue']
  const fullAppKeywords = ['web app', 'webapp', 'web application', 'full app', 'complete app', 'entire app', 'full stack', 'full infrastructure']
  
  const isSingleService = infrastructureType.toLowerCase().includes('single') || 
                         (singleServiceKeywords.some(keyword => requirements.toLowerCase().includes(keyword)) && 
                          !fullAppKeywords.some(keyword => requirements.toLowerCase().includes(keyword)))

  if (isSingleService) {
    console.log('⚡ Handler: Detected single service request, creating directly')
    return handleInfrastructureDetails("Single Service", requirements, requirements)
  }

  // Detect complexity/scale from requirements
  const requirementsLower = requirements.toLowerCase()
  let detectedComplexity = "Custom Configuration"
  
  // Check if user wants a full web app with multiple components
  const wantsFullWebApp = requirementsLower.includes('web app') || 
                         requirementsLower.includes('webapp') || 
                         requirementsLower.includes('web application') ||
                         requirementsLower.includes('full app') ||
                         requirementsLower.includes('complete app') ||
                         requirementsLower.includes('entire app') ||
                         requirementsLower.includes('full stack') ||
                         requirementsLower.includes('full infrastructure') ||
                         requirementsLower.includes('at least 3') ||
                         requirementsLower.includes('multiple components') ||
                         requirementsLower.includes('all components')
  
  if (wantsFullWebApp && normalizedType !== "Web Application") {
    console.log('🎯 Handler: User wants full web app, overriding type to Web Application')
    return handleInfrastructureDetails("Web Application", "Full web application with multiple components", requirements)
  }
  
  if (requirementsLower.includes('basic') || requirementsLower.includes('simple') || requirementsLower.includes('minimal')) {
    detectedComplexity = "Basic Setup"
  } else if (requirementsLower.includes('production') || requirementsLower.includes('enterprise') || requirementsLower.includes('high availability')) {
    detectedComplexity = "Production Ready"
  } else if (requirementsLower.includes('development') || requirementsLower.includes('dev') || requirementsLower.includes('test')) {
    detectedComplexity = "Development Setup"
  }

  console.log('⚡ Handler: Creating infrastructure directly with:', normalizedType, detectedComplexity)
  return handleInfrastructureDetails(normalizedType, detectedComplexity, requirements)
}

async function handleAnalyzeArchitecture(args: any) {
  const { analysisType, currentSetup } = args

  return {
    type: 'text',
    content: `I'll help you analyze your architecture for ${analysisType} improvements.${currentSetup ? `\n\nCurrent setup: ${currentSetup}` : ''}

Based on your requirements, here are the key areas I recommend focusing on:

**1. Resource Assessment**
• Review current resource utilization and sizing
• Identify over-provisioned or under-utilized instances
• Check for single points of failure

**2. Performance Analysis**
• Network latency and throughput analysis
• Database query optimization opportunities
• Application response time monitoring

**3. Cost Optimization**
• Reserved instance and savings plan opportunities
• Storage tier optimization
• Right-sizing recommendations

**4. Security Review**
• IAM policy analysis and least privilege
• Network security group configurations
• Data encryption and access controls

Would you like me to dive deeper into any of these areas or help you implement specific improvements?`
  }
}

async function handleTroubleshootIssues(args: any) {
  const { issueType, errorDetails } = args

  let troubleshootingGuide = ""

  switch (issueType) {
    case "deployment":
      troubleshootingGuide = `**Deployment Troubleshooting Guide**

**Common Issues:**
• Terraform state conflicts
• Provider authentication problems
• Resource dependency errors
• IAM permission issues

**Debugging Steps:**
1. Check CloudWatch logs for detailed error messages
2. Run \`terraform validate\` to check syntax
3. Use \`terraform plan\` to preview changes
4. Verify IAM permissions and roles

**Quick Fixes:**
• Clear Terraform state if corrupted
• Update provider versions
• Check for resource limits${errorDetails ? `\n\nSpecific error: ${errorDetails}` : ''}

What specific error message are you seeing?`
      break

    case "connectivity":
      troubleshootingGuide = `**Network Connectivity Troubleshooting**

**Common Issues:**
• Security group misconfigurations
• Routing table problems
• DNS resolution failures
• Load balancer health check issues

**Debugging Steps:**
1. Test connectivity with telnet/nc commands
2. Check security group inbound/outbound rules
3. Verify routing table configurations
4. Test DNS resolution with nslookup

**Network Tools:**
• Use VPC flow logs to trace connections
• Check NACL rules for blocking
• Verify internet gateway configuration${errorDetails ? `\n\nSpecific issue: ${errorDetails}` : ''}

Can you describe the connectivity problem in more detail?`
      break

    case "performance":
      troubleshootingGuide = `**Performance Troubleshooting Guide**

**Common Bottlenecks:**
• CPU/memory exhaustion
• Disk I/O limitations
• Network bandwidth constraints
• Database connection limits

**Analysis Steps:**
1. Check CloudWatch metrics for resource utilization
2. Review application logs for error patterns
3. Monitor database query performance
4. Check network latency and throughput

**Optimization Strategies:**
• Right-size instances based on usage patterns
• Implement auto-scaling for variable loads
• Use caching for frequently accessed data
• Optimize database queries and indexing${errorDetails ? `\n\nPerformance issue: ${errorDetails}` : ''}

What specific performance problems are you experiencing?`
      break

    case "cost":
      troubleshootingGuide = `**Cost Optimization Troubleshooting**

**Common Cost Issues:**
• Unexpected data transfer charges
• Over-provisioned resources
• Unused or zombie resources
• Inefficient storage usage

**Cost Analysis:**
1. Review Cost Explorer for spending patterns
2. Check for unused resources to terminate
3. Analyze data transfer and storage costs
4. Review reserved instance coverage

**Optimization Actions:**
• Implement auto-scaling to match demand
• Use spot instances for fault-tolerant workloads
• Optimize storage tiers and lifecycle policies
• Set up billing alerts and budgets${errorDetails ? `\n\nCost concern: ${errorDetails}` : ''}

What specific cost issues are you facing?`
      break
  }

  return {
    type: 'text',
    content: troubleshootingGuide
  }
}

async function handleProvideBestPractices(args: any) {
  const { topic, context } = args

  // Generate best practices based on the topic
  let bestPractices = ""
  
  const topicLower = topic.toLowerCase()
  
  if (topicLower.includes("security")) {
    bestPractices = `🔒 **Security Best Practices**

**Identity & Access Management:**
• Implement least privilege principle
• Use IAM roles instead of access keys  
• Enable multi-factor authentication
• Regular access reviews and key rotation

**Network Security:**
• Configure security groups with minimal required access
• Use private subnets for sensitive resources
• Implement WAF for web application protection
• Enable flow logs for monitoring

**Data Protection:**
• Encrypt data at rest and in transit
• Use managed encryption services (KMS)
• Implement proper backup and recovery
• Regular security assessments and audits`

  } else if (topicLower.includes("cost") || topicLower.includes("optimization")) {
    bestPractices = `💰 **Cost Optimization Best Practices**

**Resource Management:**
• Right-size instances based on actual usage
• Use auto-scaling to match demand
• Implement lifecycle policies for storage
• Regular cleanup of unused resources

**Purchasing Strategies:**
• Analyze usage patterns for reserved instances
• Use savings plans for flexible compute
• Consider spot instances for fault-tolerant workloads
• Monitor and optimize data transfer costs

**Architectural Efficiency:**
• Use serverless for variable workloads
• Implement caching to reduce compute needs
• Optimize database queries and connections
• Regular cost reviews and optimization`

  } else if (topicLower.includes("availability") || topicLower.includes("reliability")) {
    bestPractices = `⚡ **High Availability Best Practices**

**Multi-Zone Architecture:**
• Deploy across multiple availability zones
• Use load balancers for traffic distribution
• Configure databases with failover capability
• Implement cross-region replication where needed

**Resilience & Recovery:**
• Set up automated health checks
• Implement graceful degradation
• Create disaster recovery procedures
• Regular backup and recovery testing

**Monitoring & Response:**
• Comprehensive monitoring and alerting
• Automated incident response where possible
• Clear escalation procedures
• Post-incident reviews and improvements`

  } else if (topicLower.includes("performance")) {
    bestPractices = `📈 **Performance Optimization Best Practices**

**Compute Optimization:**
• Right-size instances for workload requirements
• Use appropriate instance types for use case
• Implement auto-scaling for variable demand
• Monitor resource utilization patterns

**Data & Storage Performance:**
• Optimize database queries and indexing
• Use appropriate storage types for access patterns
• Implement caching strategies
• Consider read replicas for read-heavy workloads

**Network & Delivery:**
• Use content delivery networks (CDN)
• Optimize data transfer patterns
• Implement connection pooling
• Monitor latency and throughput metrics`

  } else {
    // General best practices
    bestPractices = `🏗️ **General Cloud Best Practices for ${topic}**

**Architecture Principles:**
• Design for scalability and flexibility
• Implement proper monitoring and logging
• Use automation where possible
• Follow security-first approach

**Operational Excellence:**
• Document your architecture and processes
• Implement Infrastructure as Code
• Regular reviews and optimization
• Continuous learning and improvement`
  }

  if (context) {
    bestPractices += `\n\n**Context-Specific Considerations:**\n${context}\n\nThese recommendations should be adapted to your specific situation and requirements.`
  }

  return {
    type: 'text',
    content: bestPractices
  }
}

function handleInfrastructureDetails(type: string, complexity: string, requirements?: string) {
  // Return detailed checklist based on infrastructure type and complexity
  const checklist = getInfrastructureChecklist(type, complexity)
  const infrastructure = generateInfrastructureComponents(type, complexity)

  return {
    type: 'todolist',
    content: `I've successfully created your ${complexity.toLowerCase()} for ${type}. The infrastructure has been added to your canvas with ${infrastructure.length} connected services. Here's your deployment checklist:`,
    items: checklist,
    createInfrastructure: infrastructure
  }
}

function generateInfrastructureComponents(type: string, complexity: string): any[] {
  // Generate infrastructure components based on type
  const components: any[] = []

  if (type === "Web Application") {
    // Full web application stack with better positioning
    components.push(
      {
        id: "api-gateway",
        name: "API Gateway",
        provider: "aws",
        service: "api_gateway",
        position: { x: 200, y: 200 },
        config: {
          name: "web-api-gateway",
          description: "API Gateway for web application"
        }
      },
      {
        id: "sqs-queue",
        name: "Message Queue",
        provider: "aws",
        service: "sqs",
        position: { x: 400, y: 200 },
        config: {
          name: "web-app-queue",
          delay_seconds: 0,
          max_message_size: 262144,
          message_retention_period: 345600,
          receive_message_wait_time_seconds: 0,
          visibility_timeout_seconds: 30
        }
      },
      {
        id: "s3-bucket",
        name: "Storage Bucket",
        provider: "aws",
        service: "s3",
        position: { x: 200, y: 400 },
        config: {
          name: "web-app-storage-bucket",
          versioning: true,
          public_read: false
        }
      },
      {
        id: "dynamodb-table",
        name: "Database Table",
        provider: "aws",
        service: "dynamodb",
        position: { x: 400, y: 400 },
        config: {
          table_name: "web-app-data",
          hash_key: "id",
          read_capacity: 5,
          write_capacity: 5
        }
      }
    )
  } else if (type === "Single Service") {
    // Handle individual service requests with consistent positioning
    const lowerRequirements = complexity.toLowerCase()
    const timestamp = Date.now()
    
    // Center position for single services
    const centerX = 300
    const centerY = 300

    if (lowerRequirements.includes('dynamodb') || lowerRequirements.includes('dynamo')) {
      components.push({
        id: "dynamodb-table-" + timestamp,
        name: "DynamoDB Table",
        provider: "aws",
        service: "dynamodb",
        position: { x: centerX, y: centerY },
        config: {
          table_name: "my-table",
          hash_key: "id",
          read_capacity: 5,
          write_capacity: 5
        }
      })
    } else if (lowerRequirements.includes('s3')) {
      components.push({
        id: "s3-bucket-" + timestamp,
        name: "S3 Bucket",
        provider: "aws",
        service: "s3",
        position: { x: centerX, y: centerY },
        config: {
          name: "my-bucket-" + Math.random().toString(36).substring(2, 8),
          versioning: true,
          public_read: false
        }
      })
    } else if (lowerRequirements.includes('api gateway') || lowerRequirements.includes('api-gateway')) {
      components.push({
        id: "api-gateway-" + timestamp,
        name: "API Gateway",
        provider: "aws",
        service: "api_gateway",
        position: { x: centerX, y: centerY },
        config: {
          name: "my-api-gateway",
          description: "API Gateway service"
        }
      })
    } else if (lowerRequirements.includes('sqs')) {
      components.push({
        id: "sqs-queue-" + timestamp,
        name: "SQS Queue",
        provider: "aws",
        service: "sqs",
        position: { x: centerX, y: centerY },
        config: {
          name: "my-queue",
          delay_seconds: 0,
          max_message_size: 262144,
          message_retention_period: 345600,
          receive_message_wait_time_seconds: 0,
          visibility_timeout_seconds: 30
        }
      })
    } else if (lowerRequirements.includes('rds') || lowerRequirements.includes('database')) {
      components.push({
        id: "rds-instance-" + timestamp,
        name: "RDS Database",
        provider: "aws",
        service: "rds",
        position: { x: centerX, y: centerY },
        config: {
          engine: "mysql",
          engine_version: "8.0",
          instance_class: "db.t3.micro",
          allocated_storage: 20,
          storage_type: "gp2",
          db_name: "mydatabase",
          username: "admin",
          password: "changeme123",
          backup_retention_period: 7,
          backup_window: "03:00-04:00",
          maintenance_window: "sun:04:00-sun:05:00"
        }
      })
    }
  } else if (type === "Data Pipeline (ETL/ELT)") {
    components.push(
      {
        id: "s3-bucket",
        name: "Data Lake",
        provider: "aws",
        service: "s3",
        position: { x: 100, y: 100 },
        config: { name: "data-lake-bucket" }
      },
      {
        id: "lambda-etl",
        name: "ETL Function",
        provider: "aws",
        service: "lambda",
        position: { x: 300, y: 100 },
        config: { runtime: "python3.9", memory: 512 }
      },
      {
        id: "step-functions",
        name: "Pipeline Orchestrator",
        provider: "aws",
        service: "step_functions",
        position: { x: 500, y: 100 },
        config: { type: "STANDARD" }
      },
      {
        id: "redshift-cluster",
        name: "Data Warehouse",
        provider: "aws",
        service: "rds",
        position: { x: 700, y: 100 },
        config: { engine: "redshift", node_type: "dc2.large", cluster_type: "single-node" }
      }
    )
  } else if (type === "API Gateway + Lambda Functions") {
    components.push(
      {
        id: "api-gateway",
        name: "API Gateway",
        provider: "aws",
        service: "api_gateway",
        position: { x: 100, y: 100 },
        config: { protocol_type: "HTTP" }
      },
      {
        id: "lambda-function",
        name: "API Function",
        provider: "aws",
        service: "lambda",
        position: { x: 300, y: 100 },
        config: { runtime: "nodejs18.x", memory: 256 }
      },
      {
        id: "dynamodb-table",
        name: "API Data",
        provider: "aws",
        service: "dynamodb",
        position: { x: 500, y: 100 },
        config: { billing_mode: "PAY_PER_REQUEST" }
      }
    )
  }

  return components
}

function getInfrastructureChecklist(type: string, complexity: string): any[] {
  const checklists: Record<string, any[]> = {
    "Single Service": [
      {
        text: "Service added to canvas",
        description: "The requested service has been added to your canvas",
        done: true
      },
      {
        text: "Review service configuration",
        description: "Check the service settings and adjust as needed",
        done: false
      },
      {
        text: "Connect to other services",
        description: "Consider connecting this service to your existing infrastructure",
        done: false
      }
    ],
    "Web Application": [
      {
        text: "Review service connections",
        description: "Check that API Gateway, SQS, S3, and DynamoDB are properly connected on the canvas",
        done: false
      },
      {
        text: "Plan your data model",
        description: "Design how you'll use DynamoDB tables for your application data",
        done: false
      },
      {
        text: "Design API endpoints",
        description: "Plan the REST API structure you'll implement with API Gateway",
        done: false
      },
      {
        text: "Configure S3 bucket policies",
        description: "Plan security and access policies for your S3 storage bucket",
        done: false
      },
      {
        text: "Set up message processing",
        description: "Design how SQS will handle async operations and decoupling",
        done: false
      },
      {
        text: "Document your architecture",
        description: "Save or export your current infrastructure design for future reference",
        done: false
      }
    ],
    "Data Pipeline (ETL/ELT)": [
      {
        text: "Set up data sources",
        description: "Configure connections to source databases, APIs, or file systems",
        done: false
      },
      {
        text: "Design data transformation logic",
        description: "Define ETL/ELT processes, data cleansing, and transformation rules",
        done: false
      },
      {
        text: "Set up data warehouse/lake",
        description: "Configure S3, Redshift, or BigQuery for data storage",
        done: false
      },
      {
        text: "Implement orchestration",
        description: "Set up Apache Airflow, AWS Step Functions, or similar for pipeline scheduling",
        done: false
      },
      {
        text: "Configure monitoring and alerting",
        description: "Set up data quality checks, pipeline monitoring, and failure notifications",
        done: false
      },
      {
        text: "Implement data security",
        description: "Set up encryption, access controls, and data governance policies",
        done: false
      }
    ],
    "API Gateway + Lambda Functions": [
      {
        text: "Design API endpoints",
        description: "Define REST/GraphQL API structure and endpoints",
        done: false
      },
      {
        text: "Set up API Gateway",
        description: "Configure AWS API Gateway or equivalent with proper routing",
        done: false
      },
      {
        text: "Implement Lambda functions",
        description: "Create serverless functions for business logic",
        done: false
      },
      {
        text: "Configure authentication",
        description: "Set up JWT, OAuth, or API keys for secure access",
        done: false
      },
      {
        text: "Set up monitoring",
        description: "Configure CloudWatch, X-Ray, and logging for API performance",
        done: false
      },
      {
        text: "Implement rate limiting",
        description: "Configure throttling and rate limiting to prevent abuse",
        done: false
      }
    ],
    "Machine Learning Infrastructure": [
      {
        text: "Set up compute resources",
        description: "Configure GPU instances or serverless ML compute",
        done: false
      },
      {
        text: "Configure data storage",
        description: "Set up S3 buckets or data lakes for training data",
        done: false
      },
      {
        text: "Set up ML platforms",
        description: "Configure SageMaker, Vertex AI, or custom ML environments",
        done: false
      },
      {
        text: "Implement model versioning",
        description: "Set up model registry and version control",
        done: false
      },
      {
        text: "Configure monitoring",
        description: "Set up model performance monitoring and drift detection",
        done: false
      },
      {
        text: "Set up deployment pipeline",
        description: "Configure CI/CD for model training and deployment",
        done: false
      }
    ],
    "Microservices Architecture": [
      {
        text: "Design service boundaries",
        description: "Define microservice domains and responsibilities",
        done: false
      },
      {
        text: "Set up service registry",
        description: "Configure service discovery and registration",
        done: false
      },
      {
        text: "Implement API gateway",
        description: "Set up centralized API management and routing",
        done: false
      },
      {
        text: "Configure container orchestration",
        description: "Set up Kubernetes, ECS, or equivalent orchestration",
        done: false
      },
      {
        text: "Implement service mesh",
        description: "Configure Istio, Linkerd, or service mesh for observability",
        done: false
      },
      {
        text: "Set up centralized logging",
        description: "Configure ELK stack or CloudWatch for distributed logging",
        done: false
      }
    ],
    "Serverless Application": [
      {
        text: "Design function architecture",
        description: "Define serverless functions and event triggers",
        done: false
      },
      {
        text: "Set up function runtime",
        description: "Configure Lambda, Cloud Functions, or Azure Functions",
        done: false
      },
      {
        text: "Configure event sources",
        description: "Set up API Gateway, S3 triggers, or event bridges",
        done: false
      },
      {
        text: "Implement state management",
        description: "Configure DynamoDB, Redis, or other data stores",
        done: false
      },
      {
        text: "Set up monitoring",
        description: "Configure CloudWatch, Stackdriver, or function monitoring",
        done: false
      },
      {
        text: "Implement security",
        description: "Configure IAM roles, VPC, and function-level security",
        done: false
      }
    ]
  }

  return checklists[type] || [
    { text: "Set up cloud provider credentials", description: "Configure access", done: false },
    { text: "Design architecture", description: "Plan your infrastructure", done: false },
    { text: "Deploy resources", description: "Create your infrastructure", done: false },
    { text: "Test deployment", description: "Verify everything works", done: false }
  ]
}
