const API_BASE_URL = ((import.meta as any).env?.VITE_API_URL as string | undefined)
    ?? ((import.meta as any).env?.VITE_API_BASE_URL as string | undefined)
    ?? 'https://vignan-timetable-ai.onrender.com';

type AssistantResponse = {
    success: boolean;
    data?: {
        answer?: string;
        model?: string;
        context?: unknown;
    };
    message?: string;
};

export async function askAssistant(prompt: string, conversationId?: string) {
    const response = await fetch(`${API_BASE_URL}/api/assistant`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify({ prompt, conversationId }),
    });

    const payload = await response.json() as AssistantResponse;

    if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Assistant request failed.');
    }

    return payload.data?.answer ?? 'No response received from the assistant.';
}
