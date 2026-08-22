import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type QuizModuleState = {
  moduleId: string;
  published: boolean;
  passScore: number;
  questionCount: number;
  questionsAvailable: number;
  passed: boolean;
  attempts: number;
  bestScore: number | null;
};

export type MemberQuestion = {
  id: string;
  prompt: string;
  options: string[];
};

export type QuizResultItem = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  chosenIndex: number | null;
  correct: boolean;
  explanation: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  startSeconds: number | null;
};

function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

async function isStaff(supabase: any, userId: string): Promise<boolean> {
  const [{ data: admin }, { data: mod }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "moderator" }),
  ]);
  return Boolean(admin) || Boolean(mod);
}

async function assertStaff(supabase: any, userId: string) {
  if (!(await isStaff(supabase, userId))) throw new Error("Acesso apenas para a equipa");
}

/** Estado dos testes de um curso para o membro autenticado. */
export const getCourseQuizState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) => ({ courseId: String(data?.courseId ?? "") }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: questions }, { data: attempts }, staff] = await Promise.all([
      supabaseAdmin
        .from("quiz_module_settings" as never)
        .select("module_id, published, pass_score, question_count")
        .eq("course_id" as never, data.courseId as never),
      supabaseAdmin
        .from("quiz_questions" as never)
        .select("module_id")
        .eq("course_id" as never, data.courseId as never)
        .eq("active" as never, true as never),
      supabaseAdmin
        .from("quiz_attempts" as never)
        .select("module_id, score, passed")
        .eq("course_id" as never, data.courseId as never)
        .eq("user_id" as never, context.userId as never),
      isStaff(context.supabase, context.userId),
    ]);

    const counts = new Map<string, number>();
    for (const row of (questions ?? []) as Array<{ module_id: string }>) {
      counts.set(row.module_id, (counts.get(row.module_id) ?? 0) + 1);
    }

    const byModule = new Map<string, QuizModuleState>();
    for (const s of (settings ?? []) as Array<{
      module_id: string;
      published: boolean;
      pass_score: number;
      question_count: number;
    }>) {
      byModule.set(s.module_id, {
        moduleId: s.module_id,
        published: Boolean(s.published),
        passScore: s.pass_score ?? 80,
        questionCount: s.question_count ?? 5,
        questionsAvailable: counts.get(s.module_id) ?? 0,
        passed: false,
        attempts: 0,
        bestScore: null,
      });
    }
    for (const [moduleId, available] of counts) {
      if (!byModule.has(moduleId)) {
        byModule.set(moduleId, {
          moduleId,
          published: false,
          passScore: 80,
          questionCount: 5,
          questionsAvailable: available,
          passed: false,
          attempts: 0,
          bestScore: null,
        });
      }
    }

    for (const a of (attempts ?? []) as Array<{
      module_id: string;
      score: number;
      passed: boolean;
    }>) {
      const state = byModule.get(a.module_id);
      if (!state) continue;
      state.attempts += 1;
      state.bestScore = Math.max(state.bestScore ?? 0, a.score ?? 0);
      if (a.passed) state.passed = true;
    }

    return { staff, modules: Array.from(byModule.values()) };
  });

/** Perguntas do teste, sem revelar a resposta certa. */
export const getModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; moduleId: string }) => ({
    courseId: String(data?.courseId ?? ""),
    moduleId: String(data?.moduleId ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: rows }] = await Promise.all([
      supabaseAdmin
        .from("quiz_module_settings" as never)
        .select("published, pass_score, question_count")
        .eq("course_id" as never, data.courseId as never)
        .eq("module_id" as never, data.moduleId as never)
        .maybeSingle(),
      supabaseAdmin
        .from("quiz_questions" as never)
        .select("id, prompt, options")
        .eq("course_id" as never, data.courseId as never)
        .eq("module_id" as never, data.moduleId as never)
        .eq("active" as never, true as never),
    ]);

    const cfg = (settings ?? null) as
      | { published: boolean; pass_score: number; question_count: number }
      | null;
    const list = ((rows ?? []) as Array<{ id: string; prompt: string; options: unknown }>).map(
      (r) => ({
        id: r.id,
        prompt: r.prompt,
        options: Array.isArray(r.options) ? (r.options as string[]) : [],
      }),
    );
    const count = Math.max(1, cfg?.question_count ?? 5);
    const questions: MemberQuestion[] = shuffle(list).slice(0, count);

    return {
      passScore: cfg?.pass_score ?? 80,
      published: Boolean(cfg?.published),
      questions,
    };
  });

/** Corrige o teste no servidor e grava a tentativa. */
export const submitModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      courseId: string;
      moduleId: string;
      answers: Array<{ questionId: string; choice: number | null }>;
    }) => ({
      courseId: String(data?.courseId ?? ""),
      moduleId: String(data?.moduleId ?? ""),
      answers: Array.isArray(data?.answers)
        ? data.answers.slice(0, 50).map((a) => ({
            questionId: String(a?.questionId ?? ""),
            choice:
              a?.choice === null || a?.choice === undefined ? null : Number(a.choice),
          }))
        : [],
    }),
  )
  .handler(async ({ data, context }) => {
    if (!data.answers.length) throw new Error("Sem respostas");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = data.answers.map((a) => a.questionId).filter(Boolean);

    const [{ data: settings }, { data: rows }] = await Promise.all([
      supabaseAdmin
        .from("quiz_module_settings" as never)
        .select("pass_score")
        .eq("course_id" as never, data.courseId as never)
        .eq("module_id" as never, data.moduleId as never)
        .maybeSingle(),
      supabaseAdmin
        .from("quiz_questions" as never)
        .select("id, prompt, options, correct_index, explanation, lesson_id, lesson_title, start_seconds")
        .eq("course_id" as never, data.courseId as never)
        .eq("module_id" as never, data.moduleId as never)
        .in("id" as never, ids as never),
    ]);

    const passScore = ((settings ?? null) as { pass_score: number } | null)?.pass_score ?? 80;
    const byId = new Map(
      ((rows ?? []) as Array<any>).map((r) => [r.id as string, r]),
    );

    const results: QuizResultItem[] = [];
    for (const answer of data.answers) {
      const row = byId.get(answer.questionId);
      if (!row) continue;
      const chosen =
        answer.choice === null || Number.isNaN(answer.choice) ? null : Number(answer.choice);
      results.push({
        id: row.id,
        prompt: row.prompt,
        options: Array.isArray(row.options) ? row.options : [],
        correctIndex: row.correct_index,
        chosenIndex: chosen,
        correct: chosen === row.correct_index,
        explanation: row.explanation ?? null,
        lessonId: row.lesson_id ?? null,
        lessonTitle: row.lesson_title ?? null,
        startSeconds: row.start_seconds === null ? null : Number(row.start_seconds),
      });
    }

    const total = results.length || 1;
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / total) * 100);
    const passed = score >= passScore;

    await supabaseAdmin.from("quiz_attempts" as never).insert({
      user_id: context.userId,
      course_id: data.courseId,
      module_id: data.moduleId,
      score,
      passed,
      answers: results.map((r) => ({
        id: r.id,
        chosen: r.chosenIndex,
        correct: r.correct,
      })),
    } as never);

    return { score, passed, passScore, correct, total: results.length, results };
  });

/** Verifica uma única resposta (feedback imediato, com animação no cliente). */
export const checkQuizAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { questionId: string; choice: number }) => ({
    questionId: String(data?.questionId ?? ""),
    choice: Number(data?.choice),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("quiz_questions" as never)
      .select("id, correct_index, explanation, lesson_id, lesson_title, start_seconds")
      .eq("id" as never, data.questionId as never)
      .maybeSingle();
    const r = (row ?? null) as any;
    if (!r) throw new Error("Pergunta não encontrada");
    return {
      correctIndex: Number(r.correct_index),
      correct: Number(r.correct_index) === data.choice,
      explanation: (r.explanation ?? null) as string | null,
      lessonId: (r.lesson_id ?? null) as string | null,
      lessonTitle: (r.lesson_title ?? null) as string | null,
      startSeconds: r.start_seconds === null ? null : Number(r.start_seconds),
    };
  });

// ---------------- Staff ----------------

export const listModuleQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; moduleId: string }) => ({
    courseId: String(data?.courseId ?? ""),
    moduleId: String(data?.moduleId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("quiz_questions" as never)
      .select("id, prompt, options, correct_index, explanation, lesson_id, lesson_title, start_seconds, active, position")
      .eq("course_id" as never, data.courseId as never)
      .eq("module_id" as never, data.moduleId as never)
      .order("position" as never, { ascending: true });
    if (error) throw error;
    return (rows ?? []) as unknown as Array<{
      id: string;
      prompt: string;
      options: string[];
      correct_index: number;
      explanation: string | null;
      lesson_id: string | null;
      lesson_title: string | null;
      start_seconds: number | null;
      active: boolean;
      position: number;
    }>;
  });

export const saveModuleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      courseId: string;
      moduleId: string;
      published?: boolean;
      passScore?: number;
      questionCount?: number;
    }) => ({
      courseId: String(data?.courseId ?? ""),
      moduleId: String(data?.moduleId ?? ""),
      published: data?.published,
      passScore: data?.passScore === undefined ? undefined : Number(data.passScore),
      questionCount:
        data?.questionCount === undefined ? undefined : Number(data.questionCount),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, unknown> = {
      course_id: data.courseId,
      module_id: data.moduleId,
    };
    if (data.published !== undefined) patch['published'] = data.published;
    if (data.passScore !== undefined) {
      patch['pass_score'] = Math.min(100, Math.max(20, data.passScore));
    }
    if (data.questionCount !== undefined) {
      patch['question_count'] = Math.min(20, Math.max(1, data.questionCount));
    }
    const { error } = await context.supabase
      .from("quiz_module_settings" as never)
      .upsert(patch as never, { onConflict: "course_id,module_id" } as never);
    if (error) throw error;
    return { ok: true };
  });

export const updateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      prompt?: string;
      options?: string[];
      correctIndex?: number;
      explanation?: string;
      active?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const patch: Record<string, unknown> = {};
    if (data.prompt !== undefined) patch['prompt'] = String(data.prompt).trim();
    if (Array.isArray(data.options)) {
      patch['options'] = data.options.map((o) => String(o ?? "").trim());
    }
    if (data.correctIndex !== undefined) patch['correct_index'] = Number(data.correctIndex);
    if (data.explanation !== undefined) patch['explanation'] = String(data.explanation);
    if (data.active !== undefined) patch['active'] = Boolean(data.active);
    if (!Object.keys(patch).length) return { ok: true };
    const { error } = await context.supabase
      .from("quiz_questions" as never)
      .update(patch as never)
      .eq("id" as never, String(data.id) as never);
    if (error) throw error;
    return { ok: true };
  });

/** Embaralha as opções das perguntas de um módulo (mantendo a resposta certa). */
export const shuffleModuleOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string; moduleId: string }) => ({
    courseId: String(data?.courseId ?? ""),
    moduleId: String(data?.moduleId ?? ""),
  }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("quiz_questions" as never)
      .select("id, options, correct_index")
      .eq("course_id" as never, data.courseId as never)
      .eq("module_id" as never, data.moduleId as never);
    if (error) throw error;

    let updated = 0;
    for (const row of (rows ?? []) as Array<{
      id: string;
      options: unknown;
      correct_index: number;
    }>) {
      const options = Array.isArray(row.options) ? (row.options as string[]) : [];
      if (options.length < 2) continue;
      const pairs = options.map((text, idx) => ({ text, correct: idx === row.correct_index }));
      for (let j = pairs.length - 1; j > 0; j -= 1) {
        const k = Math.floor(Math.random() * (j + 1));
        [pairs[j], pairs[k]] = [pairs[k]!, pairs[j]!];
      }
      const nextCorrect = pairs.findIndex((p) => p.correct);
      await context.supabase
        .from("quiz_questions" as never)
        .update({
          options: pairs.map((p) => p.text),
          correct_index: nextCorrect < 0 ? row.correct_index : nextCorrect,
        } as never)
        .eq("id" as never, row.id as never);
      updated += 1;
    }
    return { updated };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => ({ id: String(data?.id ?? "") }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("quiz_questions" as never)
      .delete()
      .eq("id" as never, data.id as never);
    if (error) throw error;
    return { ok: true };
  });

/** Gera (ou regenera) as perguntas de um módulo a partir das transcrições. */
export const generateModuleQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      courseId: string;
      courseTitle: string;
      moduleId: string;
      moduleTitle: string;
      lessons: Array<{ id: string; title: string }>;
      count?: number;
      replace?: boolean;
    }) => ({
      courseId: String(data?.courseId ?? ""),
      courseTitle: String(data?.courseTitle ?? ""),
      moduleId: String(data?.moduleId ?? ""),
      moduleTitle: String(data?.moduleTitle ?? ""),
      lessons: Array.isArray(data?.lessons)
        ? data.lessons.slice(0, 40).map((l) => ({
            id: String(l?.id ?? ""),
            title: String(l?.title ?? ""),
          }))
        : [],
      count: data?.count === undefined ? 8 : Number(data.count),
      replace: data?.replace !== false,
    }),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const apiKey = process.env['LOVABLE_API_KEY'];
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");
    const lessonIds = data.lessons.map((l) => l.id).filter(Boolean);
    if (!lessonIds.length) throw new Error("Módulo sem aulas");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: transcripts, error } = await supabaseAdmin
      .from("lesson_transcripts" as never)
      .select("lesson_id, lesson_title, transcript, status")
      .eq("course_id" as never, data.courseId as never)
      .in("lesson_id" as never, lessonIds as never);
    if (error) throw error;

    const titles = new Map(data.lessons.map((l) => [l.id, l.title]));
    const sources = ((transcripts ?? []) as Array<any>)
      .filter((t) => t.status === "ready" && String(t.transcript ?? "").length > 400)
      .map((t) => ({
        lessonId: t.lesson_id as string,
        lessonTitle: (titles.get(t.lesson_id) ?? t.lesson_title ?? "Aula") as string,
        transcript: String(t.transcript ?? ""),
      }));

    if (!sources.length) {
      throw new Error(
        "Nenhuma aula deste módulo tem transcrição pronta. Transcreve as aulas primeiro.",
      );
    }

    const { generateModuleQuestions } = await import("./quiz.server");
    const questions = await generateModuleQuestions({
      apiKey,
      courseTitle: data.courseTitle,
      moduleTitle: data.moduleTitle,
      sources,
      count: Math.min(20, Math.max(3, data.count ?? 8)),
    });
    if (!questions.length) throw new Error("A IA não devolveu perguntas válidas. Tenta de novo.");

    if (data.replace) {
      await supabaseAdmin
        .from("quiz_questions" as never)
        .delete()
        .eq("course_id" as never, data.courseId as never)
        .eq("module_id" as never, data.moduleId as never);
    }

    const rows = questions.map((q, i) => {
      // Embaralha as opções para a resposta certa não cair sempre na letra A.
      const pairs = q.options.map((text, idx) => ({ text, correct: idx === q.correct_index }));
      for (let j = pairs.length - 1; j > 0; j -= 1) {
        const k = Math.floor(Math.random() * (j + 1));
        [pairs[j], pairs[k]] = [pairs[k]!, pairs[j]!];
      }
      return {
        course_id: data.courseId,
        module_id: data.moduleId,
        prompt: q.prompt,
        options: pairs.map((p) => p.text),
        correct_index: Math.max(
          0,
          pairs.findIndex((p) => p.correct),
        ),
        explanation: q.explanation,
        lesson_id: q.lesson_id,
        lesson_title: q.lesson_title,
        start_seconds: q.start_seconds,
        position: i,
        active: true,
      };
    });
    const { error: insertError } = await supabaseAdmin
      .from("quiz_questions" as never)
      .insert(rows as never);
    if (insertError) throw insertError;

    await supabaseAdmin.from("quiz_module_settings" as never).upsert(
      {
        course_id: data.courseId,
        module_id: data.moduleId,
        question_count: Math.min(rows.length, 5),
      } as never,
      { onConflict: "course_id,module_id" } as never,
    );

    return { generated: rows.length, lessonsUsed: sources.length };
  });

/** Analítica dos testes para o painel da equipa. */
export const getQuizAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { courseId: string }) => ({ courseId: String(data?.courseId ?? "") }))
  .handler(async ({ data, context }) => {
    await assertStaff(context.supabase, context.userId);
    const { data: attempts, error } = await context.supabase
      .from("quiz_attempts" as never)
      .select("module_id, user_id, score, passed, created_at")
      .eq("course_id" as never, data.courseId as never)
      .order("created_at" as never, { ascending: false })
      .limit(2000);
    if (error) throw error;

    const [{ data: settings }, { data: questions }] = await Promise.all([
      context.supabase
        .from("quiz_module_settings" as never)
        .select("module_id, published, pass_score, question_count")
        .eq("course_id" as never, data.courseId as never),
      context.supabase
        .from("quiz_questions" as never)
        .select("module_id, active")
        .eq("course_id" as never, data.courseId as never),
    ]);

    const settingsByModule = new Map<
      string,
      { published: boolean; passScore: number; questionCount: number }
    >();
    for (const s of (settings ?? []) as Array<any>) {
      settingsByModule.set(s.module_id, {
        published: Boolean(s.published),
        passScore: Number(s.pass_score ?? 80),
        questionCount: Number(s.question_count ?? 5),
      });
    }
    const questionsByModule = new Map<string, number>();
    for (const q of (questions ?? []) as Array<any>) {
      if (!q.active) continue;
      questionsByModule.set(q.module_id, (questionsByModule.get(q.module_id) ?? 0) + 1);
    }

    const byModule = new Map<
      string,
      { moduleId: string; attempts: number; passed: number; avgScore: number; members: Set<string> }
    >();
    const bucketOf = (moduleId: string) =>
      byModule.get(moduleId) ??
      byModule
        .set(moduleId, {
          moduleId,
          attempts: 0,
          passed: 0,
          avgScore: 0,
          members: new Set<string>(),
        })
        .get(moduleId)!;

    for (const a of (attempts ?? []) as Array<any>) {
      const bucket = bucketOf(a.module_id);
      bucket.attempts += 1;
      bucket.avgScore += Number(a.score ?? 0);
      bucket.members.add(a.user_id);
      if (a.passed) bucket.passed += 1;
    }
    for (const moduleId of settingsByModule.keys()) bucketOf(moduleId);
    for (const moduleId of questionsByModule.keys()) bucketOf(moduleId);

    return Array.from(byModule.values()).map((b) => ({
      moduleId: b.moduleId,
      attempts: b.attempts,
      passedAttempts: b.passed,
      members: b.members.size,
      avgScore: b.attempts ? Math.round(b.avgScore / b.attempts) : 0,
      published: settingsByModule.get(b.moduleId)?.published ?? false,
      passScore: settingsByModule.get(b.moduleId)?.passScore ?? 80,
      questionCount: settingsByModule.get(b.moduleId)?.questionCount ?? 5,
      questionsAvailable: questionsByModule.get(b.moduleId) ?? 0,
    }));
  });
