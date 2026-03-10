export type RunInput = {
  cart: {
    lines: Array<{
      quantity: number;
      merchandise:
        | {
            __typename: "ProductVariant";
            product: {
              collections: {
                edges: Array<{
                  node: {
                    id: string;
                  };
                }>;
              };
            };
          }
        | {
            __typename: "CustomProduct" | "Unknown";
          };
    }>;
  };
  paymentMethods: Array<{
    id: string;
    name: string;
  }>;
  paymentCustomization?: {
    metafield?: {
      value: string;
    } | null;
  } | null;
};

export type FunctionRunResult = {
  operations: Array<{
    hide?: {
      paymentMethodId: string;
    };
    rename?: {
      paymentMethodId: string;
      name: string;
    };
    move?: {
      paymentMethodId: string;
      index: number;
    };
  }>;
};
