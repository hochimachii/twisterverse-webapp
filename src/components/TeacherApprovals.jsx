// src/components/TeacherApprovals.jsx
//
// The admin's list of teacher accounts, shown only under master access.
// New sign-ups wait here until the admin approves them; approved
// accounts can be revoked and rejected ones reconsidered, so every
// decision can be undone.
//
// Purely presentational: TeacherDashboard loads the records and performs
// the review, so this can be exercised with plain props.

import {
  TEACHER_STATUS,
  teacherStatus,
  teacherFullName
} from "../services/teacherService";
import { schoolName } from "../data/schools";

function timeMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  return typeof value === "number" ? value : 0;
}

function formatDate(value) {
  const ms = timeMs(value);
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

// Rosters are read by surname.
function bySurname(a, b) {
  const key = (t) => `${t.lastName || teacherFullName(t)} ${t.firstName || ""}`.toLowerCase();
  return key(a).localeCompare(key(b));
}

function TeacherCard({ teacher, currentUid, busyWith, disabled, onReview }) {
  const status = teacherStatus(teacher);
  const name = teacherFullName(teacher);
  const isSelf = teacher.uid === currentUid;
  const isMaster = teacher.isMaster === true;
  // The rules refuse both, so the buttons aren't offered: the admin can't
  // lock themselves out, and a master account isn't reviewed from here.
  const reviewable = !isSelf && !isMaster;

  const requested = formatDate(teacher.createdAt);
  const reviewed = formatDate(teacher.reviewedAt);

  const act = (next) => onReview(teacher.uid, next);

  // Revoking is the one decision that locks out someone already using the
  // dashboard, so it asks first. It can still be undone from the
  // rejected list.
  const revoke = () => {
    const ok = window.confirm(
      `Bawiin ang access ni ${name}? Hindi na siya makakapag-login hanggang aprubahan mo siya muli.`
    );
    if (ok) act(TEACHER_STATUS.rejected);
  };

  return (
    <li className={`teacher-request teacher-request--${status}`}>
      <div className="teacher-request__info">
        <span className="teacher-request__name">
          {name}
          {isSelf && <span className="teacher-request__tag">Ikaw</span>}
          {isMaster && <span className="teacher-request__tag teacher-request__tag--admin">Admin</span>}
        </span>
        <span className="teacher-request__meta">
          {teacher.school ? schoolName(teacher.school) : "Walang paaralan"}
        </span>
        {teacher.section && (
          <span className="teacher-request__meta">
            {teacher.grade ? `Baitang ${teacher.grade} \u00B7 ` : ""}
            {teacher.section}
          </span>
        )}
        <span className="teacher-request__meta teacher-request__meta--soft">
          {teacher.username}
          {status === TEACHER_STATUS.pending && requested && ` \u00B7 Humiling ${requested}`}
          {status !== TEACHER_STATUS.pending && reviewed && ` \u00B7 Sinuri ${reviewed}`}
          {/* Records from before sign-ups were verified have neither date. */}
          {!teacher.status && " \u00B7 Account bago ang pag-apruba"}
        </span>
      </div>

      {reviewable && (
        <div className="teacher-request__actions">
          {status !== TEACHER_STATUS.approved && (
            <button
              type="button"
              className="teacher-request__btn teacher-request__btn--approve"
              onClick={() => act(TEACHER_STATUS.approved)}
              disabled={disabled}
              aria-label={`Aprubahan si ${name}`}
            >
              {busyWith === TEACHER_STATUS.approved ? "Sandali\u2026" : "Aprubahan"}
            </button>
          )}
          {status === TEACHER_STATUS.pending && (
            <button
              type="button"
              className="teacher-request__btn teacher-request__btn--reject"
              onClick={() => act(TEACHER_STATUS.rejected)}
              disabled={disabled}
              aria-label={`Tanggihan si ${name}`}
            >
              {busyWith === TEACHER_STATUS.rejected ? "Sandali\u2026" : "Tanggihan"}
            </button>
          )}
          {status === TEACHER_STATUS.approved && (
            <button
              type="button"
              className="teacher-request__btn teacher-request__btn--reject"
              onClick={revoke}
              disabled={disabled}
              aria-label={`Bawiin ang access ni ${name}`}
            >
              {busyWith === TEACHER_STATUS.rejected ? "Sandali\u2026" : "Bawiin"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Group({ title, hint, teachers, emptyText, ...cardProps }) {
  return (
    <section className="teacher-approvals__group">
      <h2 className="teacher-approvals__title">
        {title} <span className="teacher-approvals__count">{teachers.length}</span>
      </h2>
      {hint && <p className="teacher-approvals__hint">{hint}</p>}
      {teachers.length === 0 ? (
        <p className="teacher-empty">{emptyText}</p>
      ) : (
        <ul className="teacher-approvals__list">
          {teachers.map((t) => (
            <TeacherCard
              key={t.uid}
              teacher={t}
              busyWith={cardProps.busy?.uid === t.uid ? cardProps.busy.status : null}
              disabled={Boolean(cardProps.busy)}
              currentUid={cardProps.currentUid}
              onReview={cardProps.onReview}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TeacherApprovals({
  teachers,
  currentUid,
  loading,
  error,
  reviewError,
  busy,
  onReview,
  onRetry
}) {
  if (loading) {
    return <p className="loading-text">Naglo-load ng mga guro...</p>;
  }
  if (error) {
    return (
      <div className="teacher-approvals__error">
        <p className="teacher-empty">{error}</p>
        {onRetry && (
          <button type="button" className="teacher-export__btn" onClick={onRetry}>
            Subukan Muli
          </button>
        )}
      </div>
    );
  }

  const withStatus = (s) => teachers.filter((t) => teacherStatus(t) === s);
  // Oldest request first: whoever has waited longest is seen first.
  const pending = withStatus(TEACHER_STATUS.pending).sort(
    (a, b) => timeMs(a.createdAt) - timeMs(b.createdAt)
  );
  const approved = withStatus(TEACHER_STATUS.approved).sort(bySurname);
  const rejected = withStatus(TEACHER_STATUS.rejected).sort(bySurname);

  // busy is { uid, status } while a review is being saved. Every button
  // waits for it, so two decisions can't race each other.
  const cardProps = { currentUid, busy, onReview };

  return (
    <div className="teacher-approvals">
      {reviewError && (
        <p className="teacher-approvals__review-error" role="alert">
          {reviewError}
        </p>
      )}

      <Group
        title="Naghihintay ng Pag-apruba"
        hint="Suriin ang pangalan, paaralan at seksyon bago aprubahan. Makakapag-login lamang ang guro kapag inaprubahan mo."
        teachers={pending}
        emptyText="Walang naghihintay na kahilingan."
        {...cardProps}
      />
      <Group
        title="Mga Aprubadong Guro"
        teachers={approved}
        emptyText="Wala pang aprubadong guro."
        {...cardProps}
      />
      <Group
        title="Tinanggihan o Binawi"
        teachers={rejected}
        emptyText="Walang tinanggihang account."
        {...cardProps}
      />
    </div>
  );
}
