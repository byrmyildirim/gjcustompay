import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Box,
  Badge,
  IndexTable,
  Banner,
  InlineStack,
  Icon,
  List,
} from "@shopify/polaris";
import {
  PlusIcon,
  SettingsIcon,
  DeleteIcon,
  EditIcon,
  CheckCircleIcon,
  AlertBubbleIcon
} from "@shopify/polaris-icons";
import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // Mevcut Payment Customization'ları getir
  const response = await admin.graphql(
    `#graphql
    query GetCustomizations {
      paymentCustomizations(first: 10) {
        edges {
          node {
            id
            title
            enabled
            metafield(namespace: "gj-custom-pay", key: "configuration") {
              value
            }
          }
        }
      }
    }`
  );

  const responseJson = await response.json();
  const customizations = responseJson.data?.paymentCustomizations?.edges || [];

  return json({ customizations });
};

export default function Index() {
  const { customizations } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const resourceName = {
    singular: "Ödeme Kuralı",
    plural: "Ödeme Kuralları",
  };

  const rowMarkup = customizations.map(
    ({ node }: any, index: number) => (
      <IndexTable.Row
        id={node.id}
        key={node.id}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {node.title}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>Gizleme (Hide)</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={node.enabled ? "success" : "info"}>
            {node.enabled ? "Aktif" : "Pasif"}
          </Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button
              icon={EditIcon}
              onClick={() => navigate("/app/configuration")}
              variant="tertiary"
            />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page fullWidth>
      <BlockStack gap="500">
        <Banner tone="warning">
          <p>Uygulama şu an test modundadır. Lütfen ayarların doğruluğundan emin olun.</p>
        </Banner>

        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              <Text as="h1" variant="headingLg">Dashboard</Text>

              <InlineStack gap="400" wrap={false}>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Aktif Özelleştirmeler</Text>
                      <Text as="p" variant="headingLg">
                        {customizations.filter((c: any) => c.node.enabled).length} / 5
                      </Text>
                      <Text as="p" variant="bodySm" tone="subdued">Aktif olan kural sayısı</Text>
                    </BlockStack>
                  </Card>
                </Box>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Yeni Kural Ekle</Text>
                      <Button
                        variant="plain"
                        onClick={() => window.open(`shopify:admin/settings/payments/customizations`, "_blank")}
                      >
                        Ödeme Özelleştirmesi Oluştur
                      </Button>
                    </BlockStack>
                  </Card>
                </Box>
                <Box minWidth="30%">
                  <Card>
                    <BlockStack gap="200">
                      <Text as="h2" variant="headingSm">Kural İstatistikleri</Text>
                      <InlineStack gap="400">
                        <BlockStack>
                          <Text as="p" variant="bodySm">Gizleme</Text>
                          <Text as="p" variant="headingMd">{customizations.length}</Text>
                        </BlockStack>
                        <BlockStack>
                          <Text as="p" variant="bodySm">Sıralama</Text>
                          <Text as="p" variant="headingMd">0</Text>
                        </BlockStack>
                      </InlineStack>
                    </BlockStack>
                  </Card>
                </Box>
              </InlineStack>

              <Card padding="0">
                <IndexTable
                  resourceName={resourceName}
                  itemCount={customizations.length}
                  headings={[
                    { title: "Başlık" },
                    { title: "Kural Tipi" },
                    { title: "Durum" },
                    { title: "İşlem" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
                {customizations.length === 0 && (
                  <Box padding="1000">
                    <BlockStack gap="200" align="center">
                      <Text as="p" variant="bodyMd" tone="subdued">Henüz bir kural oluşturulmamış.</Text>
                      <Button onClick={() => navigate("/app/configuration")}>İlk Kuralı Ayarla</Button>
                    </BlockStack>
                  </Box>
                )}
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Sınırlamalar & Bilgiler</Text>
                  <List>
                    <List.Item>Ödeme Özelleştirme API'si şu an taslak siparişleri (draft orders) desteklememektedir.</List.Item>
                    <List.Item>Logosu olan ödeme yöntemlerini yeniden adlandıramazsınız.</List.Item>
                    <List.Item>Aynı anda en fazla 5 aktif ödeme özelleştirmesi kullanabilirsiniz.</List.Item>
                    <List.Item>Hızlı ödeme butonlarını (Express Checkout) bu uygulama gizleyemez, Shopify ayarlarından kapatılmalıdır.</List.Item>
                  </List>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
