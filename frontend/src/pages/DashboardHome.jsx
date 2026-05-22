import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

const DashboardHome = ({ title }) => {
  return (
    <div>
      <Title level={2}>{title}</Title>
      <Text>Dieser Bereich befindet sich noch in der Entwicklung.</Text>
    </div>
  );
};

export default DashboardHome;
