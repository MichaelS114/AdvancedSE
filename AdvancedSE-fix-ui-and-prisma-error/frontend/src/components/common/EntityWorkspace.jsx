import { useMemo, useState } from 'react';
import { EyeOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Drawer, Empty, Input, Select, Space, Table, Typography } from 'antd';

const { Text, Title } = Typography;

const EntityWorkspace = ({
  title,
  description,
  items,
  columns,
  rowKey = 'id',
  searchableFields = [],
  filters = [],
  detailTitle,
  renderDetail,
  emptyText = 'Keine Einträge vorhanden.'
}) => {
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch = !normalizedSearch || searchableFields.some((field) => {
        const value = item[field];
        return String(value || '').toLowerCase().includes(normalizedSearch);
      });

      const matchesFilters = filters.every((filter) => {
        const value = filterValues[filter.key];
        if (!value || value === 'all') return true;
        return item[filter.key] === value;
      });

      return matchesSearch && matchesFilters;
    });
  }, [filterValues, filters, items, search, searchableFields]);

  const tableColumns = [
    ...columns,
    {
      title: '',
      key: 'details',
      align: 'right',
      render: (_, record) => (
        <Button type="text" icon={<EyeOutlined />} onClick={() => setSelectedItem(record)} />
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>{title}</Title>
          {description ? <Text type="secondary">{description}</Text> : null}
        </div>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 220 }}
          />
          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={filterValues[filter.key] || 'all'}
              suffixIcon={<FilterOutlined />}
              style={{ width: 180 }}
              options={[{ label: filter.allLabel || 'Alle', value: 'all' }, ...filter.options]}
              onChange={(value) => setFilterValues((current) => ({ ...current, [filter.key]: value }))}
            />
          ))}
        </Space>
      </div>

      <Table
        columns={tableColumns}
        dataSource={filteredItems}
        rowKey={rowKey}
        pagination={{ pageSize: 6 }}
        locale={{ emptyText: <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />

      <Drawer
        title={selectedItem ? (detailTitle?.(selectedItem) || selectedItem.name || 'Details') : 'Details'}
        open={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        width={420}
      >
        {selectedItem ? renderDetail?.(selectedItem) : null}
      </Drawer>
    </div>
  );
};

export default EntityWorkspace;
