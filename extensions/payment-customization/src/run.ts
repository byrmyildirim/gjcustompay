import {
    RunInput,
    FunctionRunResult,
} from "../generated/api";

const NO_CHANGES: FunctionRunResult = {
    operations: [],
};

export function run(input: RunInput): FunctionRunResult {
    // Metafield'dan konfigürasyonu oku
    const configuration = JSON.parse(
        input.paymentCustomization?.metafield?.value ?? "{}"
    );

    // Eğer konfigürasyon yoksa veya aktif değilse işlem yapma
    if (!configuration.collectionId || !configuration.paymentMethodName) {
        return NO_CHANGES;
    }

    // Belirlenen koleksiyonda olan bir ürün var mı kontrol et
    const hasRestrictedProduct = input.cart.lines.some((line) => {
        if (line.merchandise.__typename === "ProductVariant") {
            // Not: run.graphql'deki inCollections(ids: $collectionIds) kısmı 
            // burada listelenir. isMember olan varsa kısıtlı ürün vardır.
            return line.merchandise.product.inCollections.some((c) => c.isMember);
        }
        return false;
    });

    if (!hasRestrictedProduct) {
        return NO_CHANGES;
    }

    // Eğer kısıtlı ürün varsa, konfigürasyonda belirtilen POS'u gizle
    const hideOperations = input.paymentMethods
        .filter((method) => {
            const name = method.name.toLowerCase();
            // Kullanıcının belirlediği mağaza adını (taksitli olanı) içeriyor mu?
            return name.includes(configuration.paymentMethodName.toLowerCase());
        })
        .map((method) => ({
            hide: {
                paymentMethodId: method.id,
            },
        }));

    return {
        operations: hideOperations,
    };
}
