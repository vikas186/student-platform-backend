export type ChatSuggestionAudience = 'student' | 'explore' | 'agent';

export type ChatSuggestion = {
  id: string;
  text: string;
};

const STUDENT_SUGGESTIONS: ChatSuggestion[] = [
  { id: 'ielts', text: 'Do I need IELTS?' },
  { id: 'explore', text: 'How does Explore work?' },
  { id: 'documents', text: 'What documents do I need to apply?' },
  { id: 'countries', text: 'Which countries can I study in?' },
  { id: 'budget', text: 'How much should I budget per year?' },
  { id: 'timeline', text: 'When should I start my application?' },
];

const AGENT_SUGGESTIONS: ChatSuggestion[] = [
  { id: 'pathways', text: 'Find partner pathways for my student' },
  { id: 'commission', text: 'What commission do we earn by university?' },
  { id: 'pending-docs', text: 'Which student documents are pending review?' },
  { id: 'applications', text: 'Summarise applications in my pipeline' },
  { id: 'linked-students', text: 'How many students are linked to my agency?' },
  { id: 'course-mapping', text: 'How does AI course mapping work for agents?' },
];

export const getChatSuggestions = (audience: ChatSuggestionAudience): ChatSuggestion[] => {
  if (audience === 'agent') return AGENT_SUGGESTIONS;
  return STUDENT_SUGGESTIONS;
};

/** @deprecated use ChatSuggestionAudience */
export type PublicChatAudience = ChatSuggestionAudience;

export const getPublicChatSuggestions = getChatSuggestions;
