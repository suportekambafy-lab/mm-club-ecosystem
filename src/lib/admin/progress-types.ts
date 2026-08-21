/** Types shared between the admin progress server layer and the UI. */

export interface StudentCourseProgress {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  startedLessons: number;
  percent: number; // 0..100
  watchedSeconds: number;
  lastWatchedAt: string | null;
  /** Aula onde o aluno está (última tocada). */
  currentLessonId: string | null;
  currentLessonTitle: string | null;
  currentLessonIndex: number | null; // 1-based
  currentLessonSeconds: number;
  /** Próxima aula não concluída, na ordem do curso. */
  nextLessonTitle: string | null;
  nextLessonIndex: number | null;
  finished: boolean;
}

export interface StudentProgressRow {
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalCompleted: number;
  totalStarted: number;
  watchedSeconds: number;
  coursesStarted: number;
  coursesFinished: number;
  overallPercent: number; // média ponderada por aulas do catálogo iniciado
  lastActivityAt: string | null;
  activeCourseTitle: string | null;
  activeLessonTitle: string | null;
  courses: StudentCourseProgress[];
}

export interface CourseAggregate {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  students: number;
  finishers: number;
  avgPercent: number;
  completions: number;
  lastActivityAt: string | null;
}

/** Ponto diário de atividade (global ou de um curso). */
export interface ProgressTimelinePoint {
  date: string; // YYYY-MM-DD
  activeStudents: number;
  lessonsCompleted: number;
  watchedHours: number;
}

export interface CourseTimeline {
  courseId: string;
  courseTitle: string;
  points: ProgressTimelinePoint[];
}

export interface ProgressOverview {
  generatedAt: string;
  totalStudents: number;
  activeLast7Days: number;
  activeLast30Days: number;
  totalCompletions: number;
  totalWatchedSeconds: number;
  catalogLessons: number;
  students: StudentProgressRow[];
  courses: CourseAggregate[];
  /** Últimos 30 dias, agregado global. */
  timeline: ProgressTimelinePoint[];
  /** Últimos 30 dias, por curso. */
  timelineByCourse: CourseTimeline[];
}
