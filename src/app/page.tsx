// src/app/page.tsx
import { redirect } from 'next/navigation';

export default function Root() {
  redirect('/fast'); // o /fast/lobby o /fast/build, a tua scelta
}
