import * as React from 'react';
import { QuestionCircle } from '@ant-design/icons';
import { Form, Checkbox, Button, Select, Row, Col, Radio, message, Switch, Tooltip } from 'antd';
import { IStepItemForm } from '@/components/StepForm/StepItem';
import NpmClientForm from '@/components/NpmClientForm';
import CardForm, { IOption } from '@/components/CardForm';
import { REACT_FEATURES, SPEEDUP_CLIENTS } from '@/enums';
import ProjectContext from '@/layouts/ProjectContext';

const { useContext } = React;

const Form2: React.FC<IStepItemForm> = (props, ref) => {
  const { goPrev, handleFinish, style, active } = props;
  const { formatMessage } = useContext(ProjectContext);
  const [form] = Form.useForm();
  // tmp options, real from server
  const options: IOption[] = [
    {
      title: 'Ant Design Pro 模板',
      description: '选择一个由流程编排提供的典型用户案例，',
      link: 'http://preview.pro.ant.design',
      value: 'ant-design-pro',
    },
    {
      title: '基础模板',
      description: '选择一个由流程编排提供的典型用户案例，',
      link: 'http://preview.pro.ant.design',
      value: 'app',
    },
  ];

  return (
    <Form
      style={style}
      form={form}
      ref={ref}
      layout="vertical"
      name="form_create_project"
      onFinish={handleFinish}
      initialValues={{
        args: {
          language: 'JavaScript',
        },
        taobaoSpeedUp: true,
      }}
    >
      <Form.Item
        name="type"
        label="模板"
        rules={[{ required: true, message: formatMessage({ id: '请选择模板' }) }]}
      >
        <CardForm options={options} />
      </Form.Item>
      <Form.Item
        shouldUpdate={(prevValues, curValues) => prevValues.type !== curValues.type}
        style={{ marginBottom: 0 }}
      >
        {({ getFieldValue }) => {
          const isShow = getFieldValue('type') === 'app';
          return (
            isShow && (
              <Form.Item
                name={['args', 'reactFeatures']}
                label="技术栈"
                rules={[{ type: 'array', message: formatMessage({ id: '请选择特性' }) }]}
                style={{ marginBottom: 0 }}
              >
                <Checkbox.Group style={{ width: '100%' }}>
                  <Row>
                    {Object.keys(REACT_FEATURES).map((feature: any) => (
                      <Col key={feature} span={8} style={{ marginBottom: 8 }}>
                        <Checkbox value={feature}>{REACT_FEATURES[feature]}</Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
            )
          );
        }}
      </Form.Item>
      <Form.Item
        name={['args', 'language']}
        label="语言"
        rules={[{ required: true, message: formatMessage({ id: '请选择语言' }) }]}
      >
        <Radio.Group>
          <Radio value="JavaScript">JavaScript</Radio>
          <Radio value="TypeScript">TypeScript</Radio>
        </Radio.Group>
      </Form.Item>
      {active && (
        <Form.Item
          name="npmClient"
          label="包管理"
          rules={[{ required: true, message: formatMessage({ id: '请选择包管理器' }) }]}
        >
          <NpmClientForm />
        </Form.Item>
      )}
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, curValues) => prevValues.npmClient !== curValues.npmClient}
      >
        {({ getFieldValue }) => {
          const client = getFieldValue('npmClient') as string;
          const shouldSpeedUp = Object.keys(SPEEDUP_CLIENTS).includes(client);
          return (
            shouldSpeedUp && (
              <Form.Item
                name="taobaoSpeedUp"
                label={
                  <span>
                    淘宝源加速&nbsp;
                    <Tooltip title="国内用户使用淘宝源可以更快速地安装模块">
                      <QuestionCircle />
                    </Tooltip>
                  </span>
                }
              >
                <Switch defaultChecked />
              </Form.Item>
            )
          );
        }}
      </Form.Item>
      <Form.Item style={{ marginTop: 16 }}>
        <>
          <Button onClick={() => goPrev()}>{formatMessage({ id: '上一步' })}</Button>
          <Button htmlType="submit" type="primary" style={{ marginLeft: 8 }}>
            {formatMessage({ id: '完成' })}
          </Button>
        </>
      </Form.Item>
    </Form>
  );
};

export default React.forwardRef(Form2);
