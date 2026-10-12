import { useEffect, useState } from "react";
import {
  type CourseOverview,
  type LessonOverview,
  type LessonPage,
  MAIN_CONTENT_ID,
} from "../course/page";
import { SectionNavigation } from "./components/section-navigation";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Markdown } from "./markdown";
import "katex/dist/katex.min.css";
import "./styles/globals.css";

async function readJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "无法加载课程内容。");
  return data as T;
}

function Neighbor({ lesson, label }: { lesson: LessonOverview | undefined; label: string }) {
  if (!lesson) return <div />;
  const content = (
    <>
      <span className="block text-xs text-muted-foreground">{label}</span>
      <span className="mt-2 block text-sm font-semibold leading-snug">{lesson.title}</span>
      {lesson.status === "planned" && (
        <Badge variant="outline" className="mt-3">
          计划中
        </Badge>
      )}
    </>
  );
  return lesson.status === "generated" ? (
    <a className="neighbor-link py-4 hover:text-primary" href={`/lessons/${lesson.id}`}>
      {content}
    </a>
  ) : (
    <div className="py-4 text-muted-foreground">{content}</div>
  );
}

export function CourseView({
  course,
  lessonId,
  page,
}: {
  course: CourseOverview;
  lessonId?: string;
  page?: LessonPage;
}) {
  const lessonIndex = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  const lesson = course.lessons[lessonIndex];
  const available = course.lessons.filter((item) => item.status === "generated").length;
  return (
    <>
      <a href={`#${MAIN_CONTENT_ID}`} className="skip-link">
        跳转到正文
      </a>
      <header className="site-header">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
          <a href="/" className="site-wordmark">
            Teach Kit
            <span aria-hidden="true" className="text-primary">
              .
            </span>
          </a>
          {lesson ? (
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <a href="/">课程概览</a>
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground sm:text-sm">课程笔记</span>
          )}
        </div>
      </header>
      <main
        id={MAIN_CONTENT_ID}
        tabIndex={-1}
        className={`reading-column ${lesson ? "" : "course-index"} outline-none`}
      >
        <div className="reading-heading">
          <p className="mb-4 text-xs text-muted-foreground">
            {lesson
              ? `${course.title} · 第 ${String(lessonIndex + 1).padStart(2, "0")} 课`
              : "一课一课地学习"}
          </p>
          <h1 className={lesson ? "lesson-title" : "course-title"}>
            {lesson?.title ?? course.title}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {lesson?.description ?? course.description}
          </p>
          <div className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground sm:text-sm">
            {lesson ? (
              <>
                <span>
                  第 {lessonIndex + 1} 课，共 {course.lessons.length} 课
                </span>
                <span aria-hidden="true">·</span>
                <span>课程笔记</span>
              </>
            ) : (
              <>
                <span>{course.lessons.length} 课</span>
                <span aria-hidden="true">·</span>
                <span>{available} 已完成</span>
                <span aria-hidden="true">·</span>
                <span>{course.lessons.length - available} 计划中</span>
              </>
            )}
          </div>
        </div>
        {lesson && page ? (
          <>
            <SectionNavigation key={lesson.id} sections={page.sections} />
            <article aria-label={lesson.title} className="lesson-prose">
              <Markdown tree={page.tree} />
            </article>
            <nav
              aria-label="课程导航"
              className="mt-10 grid gap-4 border-t pt-4 sm:grid-cols-2 sm:gap-10"
            >
              <Neighbor lesson={course.lessons[lessonIndex - 1]} label="上一课" />
              <Neighbor lesson={course.lessons[lessonIndex + 1]} label="下一课" />
            </nav>
          </>
        ) : (
          <section aria-labelledby="learning-route">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-5">
              <h2 id="learning-route" className="text-base font-semibold">
                学习路线
              </h2>
              <p className="text-xs text-muted-foreground">
                按顺序阅读；尚未撰写的课程仍保留在计划中。
              </p>
            </div>
            {course.lessons.length === 0 && (
              <p className="py-10 text-muted-foreground">还没有规划课程。</p>
            )}
            <ol>
              {course.lessons.map((item, index) => (
                <li key={item.id} className="flex gap-5 border-b py-5 sm:gap-8 sm:py-6">
                  <span aria-hidden="true" className="lesson-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>第 {String(index + 1).padStart(2, "0")} 课</span>
                      <Badge
                        variant={item.status === "generated" ? "secondary" : "outline"}
                        className="text-[11px] font-normal"
                      >
                        {item.status === "generated" ? "已完成" : "计划中"}
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold leading-snug tracking-tight sm:text-lg">
                      {item.status === "generated" ? (
                        <a className="course-link hover:text-primary" href={`/lessons/${item.id}`}>
                          {item.title}
                        </a>
                      ) : (
                        item.title
                      )}
                    </h3>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
      <footer
        className={`reading-column ${lesson ? "" : "course-index"} mt-10 pb-10 text-xs text-muted-foreground`}
      >
        <div className="flex flex-wrap justify-between gap-3 border-t pt-6">
          <span>{course.title}</span>
          <span>Teach Kit · 本地预览</span>
        </div>
      </footer>
    </>
  );
}

export function App() {
  const [state, setState] = useState<{ course: CourseOverview; page?: LessonPage }>();
  const [error, setError] = useState<string>();
  const lessonId = /^\/lessons\/([^/]+)$/.exec(window.location.pathname)?.[1];
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      readJson<CourseOverview>("/api/course", controller.signal),
      lessonId
        ? readJson<LessonPage>(`/api/lessons/${lessonId}`, controller.signal)
        : Promise.resolve(undefined),
    ])
      .then(([course, page]) => {
        document.title = `${course.lessons.find((lesson) => lesson.id === lessonId)?.title ?? course.title} · Teach Kit`;
        setState(page ? { course, page } : { course });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => controller.abort();
  }, [lessonId]);
  useEffect(() => {
    if (state && window.location.hash) {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      document.getElementById(id)?.scrollIntoView();
    }
  }, [state]);
  if (error)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-semibold">无法加载课程内容</h1>
        <p role="alert" className="mt-4 whitespace-pre-wrap break-words text-destructive">
          {error}
        </p>
        <Button asChild variant="link" className="mt-4 px-0">
          <a href="/">课程概览</a>
        </Button>
      </main>
    );
  if (!state)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16" role="status">
        正在加载课程…
      </main>
    );
  return (
    <CourseView
      course={state.course}
      {...(lessonId ? { lessonId } : {})}
      {...(state.page ? { page: state.page } : {})}
    />
  );
}
