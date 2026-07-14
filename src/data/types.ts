// MM Club — Domain types
// Preparados desde já para permissões, personalização e especialistas.

export type Visibility = "public" | "purchased" | "club" | "premium";

export type ObjectiveId =
  | "criar-negocio"
  | "ia"
  | "marketing"
  | "escalar"
  | "lideranca-performance";

export interface Objective {
  id: ObjectiveId;
  label: string;
  tagline: string;
}

export interface Expert {
  id: string;
  name: string;
  role: string;
  photo: string; // URL or gradient token
  shortBio: string;
  longBio: string;
  expertise: string[];
}

export interface Lesson {
  id: string;
  title: string;
  duration: string; // "12m"
  completed?: boolean;
  videoUrl?: string;
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  tagline: string;
  description: string;
  objectiveId: ObjectiveId;
  expertId: string;
  duration: string; // "4h 20m"
  lessonsCount: number;
  progress: number; // 0..1
  visibility: Visibility;
  cover: string; // gradient / image token
  logo?: string; // URL for course logo (shown as brand mark)
  modules?: Module[];
  status?: "live" | "coming-soon";
  releaseLabel?: string; // "Disponível em breve" | "Novembro 2026"
}

export interface Live {
  id: string;
  title: string;
  expertId: string;
  startsAt: string; // ISO
  duration: string;
  visibility: Visibility;
  cover: string;
  recording?: boolean;
}

export interface Tool {
  id: string;
  title: string;
  description: string;
  category:
    | "Prompts"
    | "Templates"
    | "Checklists"
    | "Planilhas"
    | "Fornecedores"
    | "Recursos"
    | "Scripts"
    | "Calculadoras";
  visibility: Visibility;
  icon: string; // lucide name
}

export interface EventItem {
  id: string;
  title: string;
  type: "Summit" | "Presencial" | "Masterclass" | "Networking";
  date: string; // display string
  location: string;
  visibility: Visibility;
  description: string;
  cover: string;
}

export type NewsType = "course" | "expert" | "live" | "tool" | "jade";

export interface NewsItem {
  id: string;
  type: NewsType;
  title: string;
  subtitle: string;
  timeAgo: string;
  href: string;
}

export interface CommunityNotice {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
}

// Personalização — Dashboard config por utilizador
export type DashboardBlockId =
  | "continue"
  | "recommended"
  | "next-live"
  | "news"
  | "top-tools"
  | "upcoming-events"
  | "jade"
  | "community";

export interface DashboardConfig {
  blocks: DashboardBlockId[]; // ordem + presença
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatarInitials: string;
  entitlements: Visibility[]; // que níveis de conteúdo pode ver
  dashboard: DashboardConfig;
}
