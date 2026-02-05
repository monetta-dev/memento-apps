'use client';

import { useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Typography, message, Divider } from 'antd';
import { MailOutlined, LockOutlined, GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

export const dynamic = 'force-dynamic';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [form] = Form.useForm();
  const router = useRouter();
  // const searchParams = useSearchParams();
  const { signIn, signInWithGoogle, isLoading } = useAuth();
  const [loginLoading, setLoginLoading] = useState(false);

  const redirect = '/';

  const onFinish = async (values: { email: string; password: string }) => {
    setLoginLoading(true);
    const { error } = await signIn(values.email, values.password);
    setLoginLoading(false);

    if (error) {
      message.error(error.message || 'ログインに失敗しました');
    } else {
      message.success('ログインしました');
      router.push(redirect);
    }
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 20 
    }}>
      <Card style={{ width: '100%', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ marginBottom: 8 }}>Memento 1on1</Title>
          <Text type="secondary">1on1をより効果的に、継続的に</Text>
        </div>

        <Form
          form={form}
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="email"
            label="メールアドレス"
            rules={[
              { required: true, message: 'メールアドレスを入力してください' },
              { type: 'email', message: '有効なメールアドレスを入力してください' }
            ]}
          >
            <Input 
              prefix={<MailOutlined />} 
              placeholder="you@example.com" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="パスワード"
            rules={[{ required: true, message: 'パスワードを入力してください' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loginLoading || isLoading}
              block
              size="large"
            >
              ログイン
            </Button>
          </Form.Item>

           <Divider>または</Divider>

           <Form.Item>
             <Button 
               icon={<GoogleOutlined />}
               onClick={() => signInWithGoogle()}
               loading={isLoading}
               block
               size="large"
               style={{ 
                 backgroundColor: '#fff',
                 color: '#757575',
                 borderColor: '#ddd',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 gap: 8
               }}
             >
               Googleでログイン
             </Button>
           </Form.Item>

           <div style={{ textAlign: 'center' }}>
             <Text type="secondary">アカウントをお持ちでないですか？</Text>
             <Button 
               type="link" 
               onClick={() => router.push('/signup')}
               style={{ paddingLeft: 4 }}
             >
               新規登録
             </Button>
           </div>
        </Form>
      </Card>
    </div>
    </Suspense>
  );
}