"use client"

import React, { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageSquare,
  Send,
  Bot,
  User,
  CheckCircle,
  Circle,
  Brain,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { processUserMessage } from '@/lib/openai-agent'
import { addInfrastructureToCanvas, convertApiResponseToComponents } from '@/lib/infrastructure-manager'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  type?: 'text' | 'dialogue_options' | 'multiple_choice' | 'todo_list' | 'todolist'
  options?: DialogueOption[]
  choices?: string[]
  onChoice?: (choice: string) => void
  todos?: TodoItem[]
  createInfrastructure?: any[]
  confirmed?: boolean
}

interface DialogueOption {
  title: string
  description?: string
  icon?: string
}

interface TodoItem {
  text: string
  description?: string
  done: boolean
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  
  // Quick demo questions
  const demoQuestions = [
    "Can you create a simple web app architecture?",
    "What's RDS?",
    "Why this architecture?",
    "How much will this cost?",
    "How do I make it secure?",
    "What if I have 100k users?",
    "How does this scale?",
    "What's DynamoDB?",
    "How do I monitor this?",
    "Can I add a database?",
    "What's API Gateway?",
    "How do I deploy this?",
    "What's S3 used for?",
    "How do I add authentication?",
    "What's SQS?",
    "How do I optimize costs?",
    "What if it goes down?",
    "How do I backup data?",
    "What's the best region?",
    "How do I add logging?",
    "Can I use Lambda?"
  ]
  
  // Fixed question that's always shown
  const fixedQuestion = "Can you create a simple web app architecture?"

  // Get 2 random questions (excluding the fixed one)
  const getRandomQuestions = () => {
    const shuffled = [...demoQuestions.filter(q => q !== fixedQuestion)].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, 2)
  }

  const [quickQuestions, setQuickQuestions] = useState<string[]>(getRandomQuestions())

  // Clean AI response text - remove unwanted formatting
  const cleanResponseText = (text: string): string => {
    return text
      .replace(/\*+/g, '') // Remove asterisks
      .replace(/#+/g, '') // Remove hash symbols
      .replace(/_{2,}/g, '') // Remove multiple underscores
      .replace(/~{2,}/g, '') // Remove multiple tildes
      .replace(/`{2,}/g, '') // Remove multiple backticks
      .replace(/\n{3,}/g, '\n\n') // Limit to max 2 newlines
      .trim() // Remove leading/trailing whitespace
  }

  // Handle quick question click - send immediately
  const handleQuickQuestion = useCallback(async (question: string) => {
    console.log('🚀 AgentChat: Sending quick question:', question)

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: question,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)
    
    // Generate new random questions after using one
    setQuickQuestions(getRandomQuestions())

    try {
      console.log('📡 AgentChat: Calling OpenAI agent API...')
      // Use OpenAI agent to process the message
      const response = await processUserMessage(question, messages.slice(-5))
      console.log('✅ AgentChat: Received response:', response)

      let agentResponse: Message

      if (response.type === 'multiple_choice' && response.choices) {
        agentResponse = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content),
          timestamp: Date.now(),
          type: 'multiple_choice',
          choices: response.choices,
          onChoice: response.onChoice
        }
      } else if (response.type === 'todolist' && response.items) {
        agentResponse = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content),
          timestamp: Date.now(),
          type: 'todolist',
          todos: response.items,
          createInfrastructure: response.createInfrastructure
        }
      } else {
        agentResponse = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content),
          timestamp: Date.now(),
          type: 'text'
        }
      }

      setMessages(prev => [...prev, agentResponse])

      // Handle infrastructure creation if present
      if (response.createInfrastructure && Array.isArray(response.createInfrastructure)) {
        console.log('🏗️ AgentChat: Adding infrastructure to canvas:', response.createInfrastructure.length, 'components')
        const success = await addInfrastructureToCanvas(response.createInfrastructure)
        if (success) {
          console.log('✅ AgentChat: Infrastructure added successfully')
        } else {
          console.error('❌ AgentChat: Failed to add infrastructure')
        }
      }

    } catch (error) {
      console.error('💥 AgentChat: Error processing quick question:', error)
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I'm having trouble processing your question right now. Please try again.",
        timestamp: Date.now(),
        type: 'text'
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      console.log('🏁 AgentChat: Finished processing quick question')
    }
  }, [messages])

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  // Initialize with welcome message after hydration
  useEffect(() => {
    if (messages.length === 0 && isHydrated) {
      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: "Hello! I'm Rex, your infrastructure assistant. How can I help you today?",
        timestamp: Date.now(),
        type: 'dialogue_options',
        options: [
          {
            title: "Create Infrastructure",
            description: "Design and deploy cloud resources",
            icon: "🏗️"
          },
          {
            title: "Analyze Architecture",
            description: "Review and optimize existing setups",
            icon: "🔍"
          },
          {
            title: "Troubleshoot Issues",
            description: "Debug deployment or configuration problems",
            icon: "🔧"
          },
          {
            title: "Learn Best Practices",
            description: "Get guidance on cloud architecture patterns",
            icon: "📚"
          }
        ]
      }
      setMessages([welcomeMessage])
    }
  }, [messages.length, isHydrated])

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim()) return

    console.log('🚀 AgentChat: Sending message:', inputValue.trim())

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsTyping(true)
    
    // Refresh quick questions after sending a message
    setQuickQuestions(getRandomQuestions())

    try {
      console.log('📡 AgentChat: Calling OpenAI agent API...')
      // Use OpenAI agent to process the message
      const response = await processUserMessage(inputValue.trim(), messages.slice(-5))
      console.log('✅ AgentChat: Received response:', response)

      let agentResponse: Message

      if (response.type === 'multiple_choice' && response.choices) {
        console.log('🔀 AgentChat: Multiple choice response received')
        agentResponse = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content),
          timestamp: Date.now(),
          type: 'multiple_choice',
          choices: response.choices,
          onChoice: response.onChoice ? ((choice: string) => {
            console.log('👆 AgentChat: Using API onChoice callback for:', choice)
            // Use the API's onChoice callback which returns structured responses directly
            const result = response.onChoice(choice)
            console.log('✅ AgentChat: API onChoice result:', result)

            // Add the user's choice to the conversation
            const choiceMessage: Message = {
              id: `user_${Date.now()}`,
              role: 'user',
              content: choice,
              timestamp: Date.now()
            }
            setMessages(prev => [...prev, choiceMessage])

            // Handle the result based on type
            if (result.type === 'todolist') {
              setMessages(prev => [...prev, {
                id: `agent_${Date.now()}`,
                role: 'assistant',
                content: cleanResponseText(result.content),
                timestamp: Date.now(),
                type: 'todo_list',
                todos: result.items
              } as Message])
            } else {
              setMessages(prev => [...prev, {
                id: `agent_${Date.now()}`,
                role: 'assistant',
                content: cleanResponseText(result.content || 'Response processed.'),
                timestamp: Date.now()
              }])
            }
          }) : (async (choice: string) => {
            console.log('👆 AgentChat: Using fallback onChoice for:', choice)
            // Handle the choice selection
            const choiceMessage: Message = {
              id: `user_${Date.now()}`,
              role: 'user',
              content: choice,
              timestamp: Date.now()
            }
            setMessages(prev => [...prev, choiceMessage])

            // Process the choice with the agent
            console.log('🔄 AgentChat: Processing follow-up choice...')
            const followUpResponse = await processUserMessage(choice, [...messages.slice(-5), choiceMessage])
            console.log('✅ AgentChat: Follow-up response:', followUpResponse)
            setMessages(prev => [...prev, {
              id: `agent_${Date.now()}`,
              role: 'assistant',
              content: cleanResponseText(followUpResponse.content),
              timestamp: Date.now(),
              type: followUpResponse.type === 'todolist' ? 'todo_list' : 'text',
              ...(followUpResponse.type === 'todolist' && { todos: followUpResponse.items })
            }])
          })
        }
      } else if (response.type === 'todolist' && response.items) {
        console.log('📋 AgentChat: Todo list response received')

        agentResponse = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content),
          timestamp: Date.now(),
          type: 'todo_list',
          todos: response.items,
          createInfrastructure: response.createInfrastructure,
          confirmed: false
        }
      } else {
        console.log('💬 AgentChat: Text response received')
        agentResponse = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: cleanResponseText(response.content || response.error || "I'm here to help with your cloud infrastructure needs."),
          timestamp: Date.now()
        }
      }

      setMessages(prev => [...prev, agentResponse])
      console.log('✨ AgentChat: Message exchange completed')
    } catch (error) {
      console.error('❌ AgentChat: Error processing message:', error)
      const errorMessage: Message = {
        id: `agent_${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble processing your request right now. Please try again.",
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
      console.log('🏁 AgentChat: Finished processing message')
    }
  }, [inputValue, messages])

  const handleOptionSelect = useCallback(async (option: DialogueOption) => {
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: option.title,
      timestamp: Date.now()
    }

    setMessages(prev => [...prev, userMessage])
    setIsTyping(true)

    try {
      console.log('🚀 AgentChat: Processing dialogue option:', option.title)
      const response = await processUserMessage(option.title, messages.slice(-5))
      console.log('✅ AgentChat: Dialogue option response:', response)

      let agentResponse: Message

      if (response.type === 'multiple_choice' && response.choices) {
        agentResponse = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: response.content,
          timestamp: Date.now(),
          type: 'multiple_choice',
          choices: response.choices,
          onChoice: response.onChoice ? ((choice: string) => {
            const result = response.onChoice!(choice)
            const choiceMessage: Message = {
              id: `user_${Date.now()}`,
              role: 'user',
              content: choice,
              timestamp: Date.now()
            }
            setMessages(prev => [...prev, choiceMessage])
            if (result.type === 'todolist') {
              setMessages(prev => [...prev, {
                id: `agent_${Date.now()}`,
                role: 'assistant',
                content: result.content,
                timestamp: Date.now(),
                type: 'todo_list',
                todos: result.items
              }])
            }
          }) : undefined
        }
      } else {
        agentResponse = {
          id: `agent_${Date.now()}`,
          role: 'assistant',
          content: response.content || 'How can I help you with that?',
          timestamp: Date.now()
        }
      }

      setMessages(prev => [...prev, agentResponse])
    } catch (error) {
      console.error('❌ AgentChat: Error processing dialogue option:', error)
      const errorMessage: Message = {
        id: `agent_${Date.now()}`,
        role: 'assistant',
        content: "I'm sorry, I'm having trouble processing your request right now.",
        timestamp: Date.now()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }, [messages])

  const handleTodoToggle = useCallback((messageId: string, todoIndex: number) => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === messageId && msg.todos
          ? {
              ...msg,
              todos: msg.todos.map((todo, index) =>
                index === todoIndex ? { ...todo, done: !todo.done } : todo
              )
            }
          : msg
      )
    )
  }, [])

  const handleConfirmPlan = useCallback(async (messageId: string) => {
    console.log('🎯 AgentChat: handleConfirmPlan called with messageId:', messageId)

    // Find the message to confirm
    const messageToConfirm = messages.find(msg => msg.id === messageId && msg.createInfrastructure && !msg.confirmed)

    if (!messageToConfirm) {
      console.log('❌ AgentChat: No valid message found to confirm')
      return
    }

    console.log('✅ AgentChat: Found message to confirm, has infrastructure:', messageToConfirm.createInfrastructure?.length || 0, 'components')
    const components = convertApiResponseToComponents({ createInfrastructure: messageToConfirm.createInfrastructure || [] })
    console.log('✅ AgentChat: Converted components:', components.length, 'items')
    console.log('📦 AgentChat: Component details:', components.map(c => ({ id: c.id, name: c.name, service: c.service })))

    console.log('🚀 AgentChat: Calling addInfrastructureToCanvas function')
    console.log('📦 AgentChat: Sending components directly to canvas')
    const success = await addInfrastructureToCanvas(components)
    console.log('✅ AgentChat: addInfrastructureToCanvas result:', success)

    // Update the message state to confirmed
    setMessages(prev => {
      console.log('📝 AgentChat: Updating messages state to confirmed')
      return prev.map(msg => {
        if (msg.id === messageId) {
          const updatedMsg = {
            ...msg,
            confirmed: true
          }
          console.log('📝 AgentChat: Message updated to confirmed state')
          return updatedMsg
        }
        return msg
      })
    })
  }, [messages])


  const renderMessage = (message: Message) => {
    return (
      <div
        key={message.id}
        className={cn(
          "flex gap-3",
          message.role === 'user' ? 'justify-end' : 'justify-start'
        )}
      >
        <div
          className={cn(
            "flex gap-2 max-w-[80%]",
            message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
          )}
        >
          {/* Avatar */}
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
            message.role === 'user'
              ? 'bg-blue-500'
              : 'bg-purple-500'
          )}>
            {message.role === 'user' ? (
              <User className="w-3 h-3 text-white" />
            ) : (
              <Bot className="w-3 h-3 text-white" />
            )}
          </div>

          {/* Message content */}
          <div className={cn(
            "rounded-lg px-3 py-2",
            message.role === 'user'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
          )}>
            {message.type === 'dialogue_options' && message.options ? (
              <div className="space-y-1">
                <p className="mb-1 text-xs text-gray-600">{message.content}</p>
                <div className="grid gap-1">
                  {message.options.map((option, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="h-auto p-2 text-left justify-start text-xs"
                      onClick={() => handleOptionSelect(option)}
                    >
                      <div className="flex items-center gap-2">
                        {option.icon && <span className="text-sm">{option.icon}</span>}
                        <div>
                          <div className="font-medium text-xs">{option.title}</div>
                          {option.description && (
                            <div className="text-xs text-muted-foreground leading-tight">{option.description}</div>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : message.type === 'multiple_choice' && message.choices ? (
              <div className="space-y-1">
                <p className="mb-1 text-xs text-gray-600">{message.content}</p>
                <div className="grid gap-1">
                  {message.choices.map((choice, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs justify-start px-2 text-left"
                      onClick={() => message.onChoice && message.onChoice(choice)}
                    >
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-medium text-xs">{choice}</div>
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            ) : message.type === 'todo_list' && message.todos ? (
              <div className="space-y-1">
                <p className="mb-1 text-xs text-gray-600">{message.content}</p>
                <div className="space-y-1">
                  {message.todos.map((todo, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTodoToggle(message.id, index)}
                    >
                      {todo.done ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      )}
                      <div>
                        <div className={cn(
                          "font-medium text-xs",
                          todo.done && "line-through text-muted-foreground"
                        )}>
                          {todo.text}
                        </div>
                        {todo.description && (
                          <div className="text-xs text-muted-foreground leading-tight">{todo.description}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Confirmation section */}
                {message.createInfrastructure && !message.confirmed && (
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-sm text-muted-foreground mb-3">
                      Ready to add this infrastructure to your canvas? Make sure you have a project open with the canvas visible. If you're not in a project, the components will be queued and added when you open one.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        console.log('🎯 Confirm button clicked for message:', message.id)
                        handleConfirmPlan(message.id)
                      }}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      ✅ Confirm & Add to Canvas
                    </Button>
                  </div>
                )}

                {message.confirmed && (
                  <div className="mt-4 pt-3 border-t">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Infrastructure added to canvas!
                        {message.createInfrastructure && (
                          <span className="ml-2 text-xs opacity-75">
                            ({message.createInfrastructure.length} components)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{message.content}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}

      {/* Chat content */}
      {isHydrated && (
        <>
          {/* Messages area */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-2 pb-2">
                <div className="space-y-2">
                  {messages.map(renderMessage)}
                  {isTyping && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
                        <div className="flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 p-2 border-t bg-white">
            {/* Quick Questions */}
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {/* Fixed question - always shown */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickQuestion(fixedQuestion)}
                className="text-xs px-2 py-1 h-6 bg-green-50 hover:bg-green-100 border-green-200 text-green-700 font-medium"
              >
                {fixedQuestion}
              </Button>

              {/* Random questions */}
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickQuestion(question)}
                  className="text-xs px-2 py-1 h-6 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                >
                  {question}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-1 items-end">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="flex-1 min-h-[32px] max-h-[120px] text-sm resize-none"
                style={{
                  height: 'auto',
                  overflow: 'hidden'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                }}
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="flex-shrink-0 h-8 w-8"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
