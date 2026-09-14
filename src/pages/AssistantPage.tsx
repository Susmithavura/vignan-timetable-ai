import { Send, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { RobotAssistant } from '../components/RobotAssistant';
import { askAssistant } from '../services/assistantApi';

const prompts = [
    'Show me the CSE-01 timetable.',
    'Which rooms are available on Tuesday P4?',
    'Show laboratory utilisation.',
    'Which faculty members are free on Wednesday P3?',
    'Are there any timetable clashes?',
];

type Message = { role: 'user' | 'assistant'; content: string };

export function AssistantPage() {
    const [prompt, setPrompt] = useState('');
    const [messages, setMessages] = useState<Message[]>([{ role: 'assistant', content: 'Ask me anything about sections, faculty, rooms, laboratories, availability, clashes, or timetable schedules.' }]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [conversationId] = useState('vignan-timetable-session');

    const handlePrompt = async (question: string) => {
        const trimmedPrompt = question.trim();
        if (!trimmedPrompt || isLoading) return;
        setPrompt('');
        setMessages((current) => [...current, { role: 'user', content: trimmedPrompt }]);
        setIsLoading(true);
        setErrorMessage(null);

        try {
            const response = await askAssistant(trimmedPrompt, conversationId);
            setMessages((current) => [...current, { role: 'assistant', content: response }]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to reach the assistant.';
            setErrorMessage(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="card p-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">AI Assistant</div>
                <div className="mt-1 text-2xl font-bold text-slate-800">Timetable AI Assistant</div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
                <div className="card p-5">
                    <RobotAssistant title="Timetable AI Assistant" />
                    <div className="mt-5 space-y-3">
                        {prompts.map((prompt) => (
                            <button
                                key={prompt}
                                type="button"
                                onClick={() => handlePrompt(prompt)}
                                className="w-full rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-sky-100"
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="card p-5">
                    <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-sky-700" />
                        <div className="text-lg font-semibold text-slate-800">Assistant response</div>
                    </div>

                    {errorMessage && (
                        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{errorMessage}</div>
                    )}

                    <div className="max-h-[32rem] space-y-3 overflow-y-auto rounded-2xl border border-sky-100 bg-slate-50 p-4">
                        {messages.map((message, index) => (
                            <div key={`${message.role}-${index}`} className={`rounded-2xl p-3 text-sm ${message.role === 'user' ? 'ml-8 bg-sky-600 text-white' : 'mr-8 bg-white text-slate-700 ring-1 ring-sky-100'}`}>
                                {message.content}
                            </div>
                        ))}
                        {isLoading && <div className="mr-8 rounded-2xl bg-white p-3 text-sm text-slate-500 ring-1 ring-sky-100">Thinking...</div>}
                    </div>

                    <form className="mt-4 flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void handlePrompt(prompt); }}>
                        <textarea
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    void handlePrompt(prompt);
                                }
                            }}
                            rows={3}
                            placeholder="Ask your timetable question..."
                            className="min-h-20 flex-1 resize-none rounded-2xl border border-sky-200 bg-white p-3 text-sm text-slate-800 outline-none focus:border-sky-500"
                        />
                        <button type="submit" disabled={isLoading || !prompt.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50">
                            <Send className="h-4 w-4" /> Send
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
