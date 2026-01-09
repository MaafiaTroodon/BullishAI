import { AuthSplitPageSuspense } from '@/app/auth/_components/AuthSplitPage'

export default function SignIn() {
  return <AuthSplitPageSuspense initialMode="signin" />
}
