'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Card, Button, Table, Modal, Form, Input, Select, Upload, App, Tag, Drawer, Descriptions, Spin } from 'antd';
import { PlusOutlined, UploadOutlined, FilePdfOutlined } from '@ant-design/icons';
import { useStore, Subordinate } from '@/store/useStore';
import { createClientComponentClient } from '@/lib/supabase';

const { Title } = Typography;
const { Option } = Select;

export default function CRMPage() {
  const { subordinates, addSubordinate, fetchSubordinates, updateSubordinate, setUserId } = useStore();
  const { message } = App.useApp();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedSub, setSelectedSub] = useState<Subordinate | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);

  // Tag State
  const [availableTags, setAvailableTags] = useState<{ label: string, value: string, color: string }[]>([]);

  useEffect(() => {
    const fetchTags = async () => {
      const supabase = createClientComponentClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Debug: Check Profile Org ID
      const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
      console.log('CRM: Current User Org ID:', profile?.organization_id);

      if (!profile?.organization_id) {
        console.warn('CRM: User has no organization_id, cannot fetch tags.');
        setAvailableTags([]);
        return;
      }

      const { data: tags, error } = await supabase
        .from('tags')
        .select('*')
        .eq('organization_id', profile.organization_id); // Explicitly filter by Org ID just in case

      if (error) {
        console.error('CRM: Error fetching tags:', error);
      }

      if (tags) {
        console.log('CRM: Fetched tags:', tags);
        setAvailableTags(tags.map(t => ({ label: t.name, value: t.id, color: t.color })));
      }
    };
    fetchTags();
  }, [isModalVisible]); // Refresh when modal opens

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      const supabase = createClientComponentClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (userId) {
        setUserId(userId);
        console.log('CRM: User ID set:', userId);
      } else {
        console.warn('CRM: No authenticated user found');
      }

      // Fetch subordinates after setting user ID
      await fetchSubordinates();
    };

    checkAuthAndFetch();
  }, [fetchSubordinates, setUserId]);

  const handleAdd = () => {
    form.validateFields().then(async (values) => {
      await addSubordinate({
        name: values.name,
        traits: ['New'], // Legacy
        tags: values.tagIds?.map((id: string) => ({ id })) // partial tag object just for ID passing
      });
      setIsModalVisible(false);
      form.resetFields();
      message.success('部下を追加しました');
    });
  };

  const showDetail = (sub: Subordinate) => {
    setSelectedSub(sub);
    setDrawerVisible(true);
  };

  const handlePdfUpload = async (file: File) => {
    if (!selectedSub) return false;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('subordinateId', selectedSub.id);

    try {
      const response = await fetch('/api/pdf/analyze', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success && Array.isArray(result.traits)) {
        // Update subordinate with extracted traits
        await updateSubordinate(selectedSub.id, {
          traits: result.traits
        });
        message.success(`PDFを分析しました。${result.traits.length}個の特性を抽出しました。`);
        return true;
      } else {
        message.error(result.error || 'PDFの分析に失敗しました');
        return false;
      }
    } catch (error) {
      console.error('Upload error:', error);
      message.error('アップロードに失敗しました。もう一度お試しください。');
      return false;
    } finally {
      setUploading(false);
    }
  };

  const columns = [
    { title: '名前', dataIndex: 'name', key: 'name', render: (text: string, record: Subordinate) => <a onClick={() => showDetail(record)}>{text}</a> },
    {
      title: '特性 / タグ',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: { name: string, color: string }[] | undefined, record: Subordinate) => (
        <>
          {/* Show new Tags */}
          {tags?.map(tag => (
            <Tag color={tag.color || 'blue'} key={tag.name}>{tag.name}</Tag>
          ))}
          {/* Fallback to legacy traits if any */}
          {(!tags || tags.length === 0) && record.traits?.map(t => <Tag key={t}>{t}</Tag>)}
        </>
      )
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>部下管理 (CRM)</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalVisible(true)}>
          部下を追加
        </Button>
      </div>

      <Card variant="borderless">
        <Table dataSource={subordinates} columns={columns} rowKey="id" />
      </Card>

      <Modal
        title="新規部下追加"
        open={isModalVisible}
        onOk={handleAdd}
        onCancel={() => setIsModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名前" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {/* 部署・役職はタグ管理に移行するため削除 */}
          <Form.Item name="tagIds" label="タグ">
            <Select mode="multiple" placeholder="タグを選択">
              {availableTags.map(tag => (
                <Option key={tag.value} value={tag.value}>
                  <Tag color={tag.color}>{tag.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="特性分析 (PDFアップロード)">
            <Upload>
              <Button icon={<UploadOutlined />}>評価PDFをアップロード</Button>
            </Upload>
            <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
              * AIがPDFを分析し、特性を自動抽出します。
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="部下詳細"
        placement="right"
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        // width={500}
        size="large"
      >
        {selectedSub && (
          <Descriptions title="ユーザー情報" bordered column={1} layout="vertical">
            <Descriptions.Item label="名前">{selectedSub.name}</Descriptions.Item>
            <Descriptions.Item label="検出された特性">
              {selectedSub.traits.length > 0 ? selectedSub.traits.map(t => <Tag key={t}>{t}</Tag>) : "まだ特性が分析されていません。"}
            </Descriptions.Item>
            <Descriptions.Item label="分析データ">
              <Spin spinning={uploading}>
                <Upload
                  accept=".pdf"
                  showUploadList={false}
                  customRequest={async ({ file }) => {
                    const success = await handlePdfUpload(file as File);
                    // Antd Upload expects `onSuccess` or `onError` callbacks
                    // We handle errors in handlePdfUpload
                    return success;
                  }}
                  disabled={uploading}
                >
                  <Button type="dashed" icon={<FilePdfOutlined />}>
                    {uploading ? '分析中...' : 'PDFをアップロードして分析'}
                  </Button>
                </Upload>
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  PDF評価レポートをアップロードしてください。AIが性格特性を抽出します。
                </div>
              </Spin>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
}
