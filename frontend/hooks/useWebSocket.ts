"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import toast from 'react-hot-toast';

interface WebSocketMessage {
    type: 'new_message' | 'message_read' | 'typing' | 'user_online' | 'notification' | 'message_sent' | 'call_offer' | 'call_answer' | 'ice_candidate' | 'call_end';
    data: any;
}

interface UseWebSocketReturn {
    sendMessage: (message: WebSocketMessage) => void;
    isConnected: boolean;
    reconnect: () => void;
    connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

// Helper function to get token from cookies (since it's HTTP-only, we need to get it from the server)
async function getTokenFromServer(): Promise<string | null> {
    try {
        const response = await fetch('/api/auth/token');
        if (response.ok) {
            const data = await response.json();
            return data.token || null;
        }
        return null;
    } catch (error) {
        console.error('Failed to get token from server:', error);
        return null;
    }
}

// Helper function to get user ID from cookies (client-side accessible)
function getUserIdFromCookies(): string | null {
    if (typeof document === 'undefined') return null;

    const cookieString = document.cookie;
    const cookies = cookieString.split(';');

    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'user_id') {
            return decodeURIComponent(value) || null;
        }
    }

    return null;
}

export function useWebSocket(
    onMessage: (message: WebSocketMessage) => void,
    dependencies: any[] = []
): UseWebSocketReturn {
    const ws = useRef<WebSocket | null>(null);
    const reconnectTimeout = useRef<NodeJS.Timeout>();
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    const getWebSocketUrl = useCallback((): string => {
    // Try environment variable first
        const envWsUrl = process.env.NEXT_MESSAGES_WEBSOCKET_URL;
        if (envWsUrl) {
            return envWsUrl;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = process.env.NEXT_PUBLIC_BACKEND_URL || window.location.host;

        // Remove any leading protocol if present (http:// or https://)
        host = host.replace(/^https?:\/\//, '');

        return `${protocol}//${host}/ws/messages`;
    }, []);


    const connect = useCallback(async () => {
        try {
            // Get token from server (HTTP-only cookie)
            const token = await getTokenFromServer();
            if (!token) {
                console.warn('No authentication token found');
                setConnectionStatus('error');
                toast.error('Please login again');
                return;
            }

            // Get user ID from cookies
            const userId = getUserIdFromCookies();
            if (!userId) {
                console.warn('No user ID found');
                setConnectionStatus('error');
                toast.error('Please login again');
                return;
            }

            const wsUrl = `${getWebSocketUrl()}?token=${token}&user_id=${userId}`;
            console.log('Connecting to WebSocket:', wsUrl.replace(token, '[REDACTED]').replace(userId, '[USER_ID]'));

            setConnectionStatus('connecting');
            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                console.log('WebSocket connected successfully');
                setIsConnected(true);
                setConnectionStatus('connected');
                reconnectAttempts.current = 0;
                toast.success('Real-time connection established');
            };

            ws.current.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    console.log('WebSocket message received:', message);
                    onMessage(message);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                    toast.error('Failed to process message');
                }
            };

            ws.current.onclose = (event) => {
                console.log('WebSocket disconnected:', event.code, event.reason);
                setIsConnected(false);
                setConnectionStatus('disconnected');

                // Don't attempt reconnect if closed normally or due to auth
                if (event.code === 1000) { // Normal closure
                    console.log('WebSocket closed normally');
                    return;
                }

                if (event.code === 1008) { // Policy violation (auth failed)
                    console.error('WebSocket authentication failed');
                    toast.error('Authentication failed - please login again');
                    return;
                }

                // Exponential backoff for reconnection
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`Attempting reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);

                    reconnectTimeout.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                } else {
                    console.error('Max reconnection attempts reached');
                    toast.error('Connection lost - please refresh the page');
                }
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
                setConnectionStatus('error');
                toast.error('Connection error');
            };

        } catch (error) {
            console.error('WebSocket connection error:', error);
            setIsConnected(false);
            setConnectionStatus('error');
            toast.error('Failed to establish connection');
        }
    }, [onMessage, getWebSocketUrl]);

    const disconnect = useCallback(() => {
        console.log('Disconnecting WebSocket...');
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
        }
        if (ws.current) {
            ws.current.close(1000, 'Manual disconnect');
        }
    }, []);

    const sendMessage = useCallback((message: WebSocketMessage) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            try {
                ws.current.send(JSON.stringify(message));
                console.log('WebSocket message sent:', message);
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                toast.error('Failed to send message');
            }
        } else {
            console.warn('WebSocket not connected, message not sent:', message);
            toast.error('Connection not available - message not sent');
        }
    }, []);

    const reconnect = useCallback(() => {
        console.log('Manual reconnection triggered');
        disconnect();
        reconnectAttempts.current = 0;
        connect();
    }, [disconnect, connect]);

    // Enhanced connection management with dependency tracking
    useEffect(() => {
        connect();

        return () => {
            disconnect();
        };
    }, [connect, disconnect, ...dependencies]);

    return {
        sendMessage,
        isConnected,
        reconnect,
        connectionStatus
    };
}

// Helper hook for specific message types
export function useMessageWebSocket(
    handlers: {
        onNewMessage?: (data: any) => void;
        onMessageRead?: (data: any) => void;
        onTyping?: (data: any) => void;
        onNotification?: (data: any) => void;
        onMessageSent?: (data: any) => void;
        onCallOffer?: (data: any) => void;
        onCallAnswer?: (data: any) => void;
        onIceCandidate?: (data: any) => void;
        onCallEnd?: (data: any) => void;
    },
    dependencies: any[] = []
) {
    const handleMessage = useCallback((message: WebSocketMessage) => {
        switch (message.type) {
            case 'new_message':
                handlers.onNewMessage?.(message.data);
                break;
            case 'message_read':
                handlers.onMessageRead?.(message.data);
                break;
            case 'typing':
                handlers.onTyping?.(message.data);
                break;
            case 'notification':
                handlers.onNotification?.(message.data);
                break;
            case 'message_sent':
                handlers.onMessageSent?.(message.data);
                break;
            case 'call_offer':
                handlers.onCallOffer?.(message.data);
                break;
            case 'call_answer':
                handlers.onCallAnswer?.(message.data);
                break;
            case 'ice_candidate':
                handlers.onIceCandidate?.(message.data);
                break;
            case 'call_end':
                handlers.onCallEnd?.(message.data);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }, [handlers]);

    return useWebSocket(handleMessage, dependencies);
}