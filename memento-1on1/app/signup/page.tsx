'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Form, Input, Typography, message, Divider } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, GoogleOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

const { Title, Text } = Typography;

export default function SignupPage() {
  const [form] = Form.useForm();
  const router = useRouter();
  const { signUp, signInWithGoogle, isLoading } = useAuth();
  const [signupLoading, setSignupLoading] = useState(false);

  const onFinish = async (values: { email: string; password: string; fullName: string; confirmPassword: string }) => {
    if (values.password !== values.confirmPassword) {
      message.error('パスワードが一致しません');
      return;
    }

    setSignupLoading(true);
    const { error } = await signUp(values.email, values.password, values.fullName);
    setSignupLoading(false);

    if (error) {
      message.error(error.message || '登録に失敗しました');
    } else {
      message.success('登録が完了しました。確認メールをご確認ください。');
      router.push('/');
    }
  };

  return (
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
          <Title level={2} style={{ marginBottom: 8 }}>新規登録</Title>
          <Text type="secondary">Memento 1on1を始めましょう</Text>
        </div>

        <Form
          form={form}
          name="signup"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="fullName"
            label="氏名"
            rules={[{ required: true, message: '氏名を入力してください' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="山田 太郎" 
              size="large"
            />
          </Form.Item>

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
            rules={[
              { required: true, message: 'パスワードを入力してください' },
              { min: 6, message: 'パスワードは6文字以上で入力してください' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="••••••••"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="パスワード（確認）"
            dependencies={['password']}
            rules={[
              { required: true, message: 'パスワードを再入力してください' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('パスワードが一致しません'));
                },
              }),
            ]}
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
              loading={signupLoading || isLoading}
              block
              size="large"
            >
              登録する
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
               Googleで登録
             </Button>
           </Form.Item>

           <div style={{ textAlign: 'center' }}>
             <Text type="secondary">既にアカウントをお持ちですか？</Text>
             <Button 
               type="link" 
               onClick={() => router.push('/login')}
               style={{ paddingLeft: 4 }}
             >
               ログイン
             </Button>
           </div>
        </Form>
      </Card>
    </div>
  );
}