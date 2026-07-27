import { useMemo, useState, useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import './ProductInventory.css';
import TransaksiTopbar from '../../transaksi/components/TransaksiTopbar';
import { TransaksiProvider, useTransaksiCrumb } from '../../transaksi/components/TransaksiContext';
import { inventoryTabs, priceLabelTabs, productTabs, specialTypeTabs } from './productInventoryData';
import ProductsPage from './products/ProductsPage';
import { AddonsPage, BrandsPage, CategoriesPage, PackagesPage, ProductOthersPage, SpecificationsPage } from './products/MasterPages';
import {
  StockAlertPage,
  StockInPage,
  StockMovementPage,
  StockOpnamePage,
  StockOutPage,
  StockProductionPage,
} from './inventory/InventoryPages';
import {
  BarcodePage,
  DepositPage,
  PriceLabelProductsPage,
  PriceLabelSettingsPage,
  ProductionCostPage,
  SpecialCollectionPage,
  SpecialLookBookPage,
  SpecialTypeListPage,
  PosStockModePage,
  MergeStocksPage,
} from './support/SupportPages';

const featureMap = {
  product: {
    title: 'Katalog Produk / Daftar Produk',
    tabs: productTabs,
    defaultTab: 'products',
  },
  inventory: {
    title: 'Inventory / Stok Masuk',
    tabs: inventoryTabs,
    defaultTab: 'stock-in',
  },
  'production-cost': {
    title: 'Production Cost',
    defaultTab: 'production-cost',
  },
  'special-type': {
    title: 'Special Type / Specialtype',
    tabs: specialTypeTabs,
    defaultTab: 'special-type-list',
  },
  barcode: {
    title: 'Print Barcode Product',
    defaultTab: 'barcode',
  },
  'price-label': {
    title: 'Cetak Label Harga / Produk Label Harga',
    tabs: priceLabelTabs,
    defaultTab: 'price-label-products',
  },
  deposit: {
    title: 'Deposit',
    defaultTab: 'deposit',
  },
  'pos-stock-mode': {
    title: 'Mode Stok POS',
    defaultTab: 'pos-stock-mode',
  },
  'merge-stocks': {
    title: 'Gabung Stok',
    defaultTab: 'merge-stocks',
  },
};

const pageMap = {
  products: ProductsPage,
  categories: CategoriesPage,
  packages: PackagesPage,
  addons: AddonsPage,
  brands: BrandsPage,
  specifications: SpecificationsPage,
  'stock-in': StockInPage,
  'stock-out': StockOutPage,
  'stock-production': StockProductionPage,
  'stock-opname': StockOpnamePage,
  'stock-movement': StockMovementPage,
  'stock-alert': StockAlertPage,
  'production-cost': ProductionCostPage,
  'special-type-list': SpecialTypeListPage,
  'special-collection': SpecialCollectionPage,
  'special-lookbook': SpecialLookBookPage,
  barcode: BarcodePage,
  'price-label-products': PriceLabelProductsPage,
  'price-label-settings': PriceLabelSettingsPage,
  deposit: DepositPage,
  'product-others': ProductOthersPage,
  'pos-stock-mode': PosStockModePage,
  'merge-stocks': MergeStocksPage,
};

function ProductInventoryInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const [, featureKey, tabKey] = location.pathname.replace(/^\//, '').split('/');
  const [isPackageCreating, setIsPackageCreating] = useState(false);
  const [isAddonCreating, setIsAddonCreating] = useState(false);
  const [stockInState, setStockInState] = useState('list'); // 'list' | 'create' | 'detail'
  const [stockOutState, setStockOutState] = useState('list'); // 'list' | 'create' | 'detail'
  const [stockProductionState, setStockProductionState] = useState('list'); // 'list' | 'detail'
  const [stockOpnameState, setStockOpnameState] = useState('list'); // 'list' | 'create' | 'detail'

  const { setSubtitle } = useTransaksiCrumb();

  useEffect(() => {
    setIsPackageCreating(false);
    setIsAddonCreating(false);
    setStockInState('list');
    setStockOutState('list');
    setStockProductionState('list');
    setStockOpnameState('list');
  }, [location.key]);

  const feature = useMemo(() => featureMap[featureKey], [featureKey]);

  useEffect(() => {
    if (!feature) return;
    const activeTab = feature.tabs ? tabKey || feature.defaultTab : feature.defaultTab;
    let sub = '';
    if (featureKey === 'product') {
      if (activeTab === 'packages' && isPackageCreating) {
        sub = 'Buat Paket Produk';
      } else if (activeTab === 'addons' && isAddonCreating) {
        sub = 'Buat Produk Tambahan';
      } else {
        const tabObj = productTabs.find(t => t.id === activeTab);
        sub = tabObj ? tabObj.label : '';
      }
    } else if (featureKey === 'inventory') {
      if (activeTab === 'stock-in') {
        if (stockInState === 'create') sub = 'Buat Stok Masuk';
        else if (stockInState === 'detail') sub = 'Detail Stok Masuk';
        else sub = 'Stok Masuk';
      } else if (activeTab === 'stock-out') {
        if (stockOutState === 'create') sub = 'Buat Stok Keluar';
        else if (stockOutState === 'detail') sub = 'Detail Stok Keluar';
        else sub = 'Stok Keluar';
      } else if (activeTab === 'stock-production') {
        if (stockProductionState === 'detail') sub = 'Detail Produksi Stock';
        else sub = 'Produksi Stock';
      } else if (activeTab === 'stock-opname') {
        if (stockOpnameState === 'create') sub = 'Buat Opname Stok';
        else if (stockOpnameState === 'detail') sub = 'Detail Stok Opname';
        else sub = 'Stok Opname';
      } else {
        const tabObj = inventoryTabs.find(t => t.id === activeTab);
        sub = tabObj ? tabObj.label : '';
      }
    } else if (featureKey === 'price-label') {
      if (activeTab === 'price-label-settings') sub = 'Konfigurasi Label Harga';
      else sub = 'Produk Label Harga';
    } else if (featureKey === 'special-type') {
      if (activeTab === 'special-collection') sub = 'Koleksi';
      else if (activeTab === 'special-lookbook') sub = 'Look Book';
      else sub = 'Tipe Special';
    } else {
      sub = feature.title || '';
    }
    setSubtitle(sub);
  }, [featureKey, tabKey, feature, isPackageCreating, isAddonCreating, stockInState, stockOutState, stockProductionState, stockOpnameState, setSubtitle]);

  if (!featureKey) return <Navigate to="/product-inventory/product" replace />;
  if (!feature) return <Navigate to="/product-inventory/product" replace />;

  const activeTab = feature.tabs ? tabKey || feature.defaultTab : feature.defaultTab;
  const ActivePage = pageMap[activeTab] || pageMap[feature.defaultTab];

  const handleTabChange = (tabId) => {
    navigate(`/product-inventory/${featureKey}/${tabId}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <TransaksiTopbar />
      
      {/* Tab atas — sama persis dengan Laporan.jsx, tanpa space */}
      {feature.tabs && !isPackageCreating && !isAddonCreating && (activeTab !== 'stock-in' || stockInState === 'list') && (activeTab !== 'stock-out' || stockOutState === 'list') && (activeTab !== 'stock-production' || stockProductionState === 'list') && (activeTab !== 'stock-opname' || stockOpnameState === 'list') ? (
        <div className="flex border-b border-slate-200 shrink-0 bg-white">
          {feature.tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 px-3 py-4 text-sm font-semibold text-center whitespace-nowrap transition-colors cursor-pointer border-b-2 ${
                  isActive
                    ? 'text-blue-600 border-blue-600 bg-white'
                    : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50/40 bg-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Area Konten */}
      <div className="flex-1 flex flex-col p-4 md:p-6 bg-slate-50 overflow-y-auto">
        <div className="pi-module pi-module-full">
          <section className="pi-full-panel" style={{ borderTop: 0 }}>
            <div className="pi-page-body" style={{ padding: 0 }}>
              <ActivePage 
                viewState={
                  activeTab === 'stock-in'
                    ? stockInState
                    : activeTab === 'stock-out'
                    ? stockOutState
                    : activeTab === 'stock-production'
                    ? stockProductionState
                    : activeTab === 'stock-opname'
                    ? stockOpnameState
                    : 'list'
                }
                onToggleCreate={
                  activeTab === 'packages' 
                    ? setIsPackageCreating 
                    : activeTab === 'addons' 
                    ? setIsAddonCreating 
                    : activeTab === 'stock-in'
                    ? setStockInState
                    : activeTab === 'stock-out'
                    ? setStockOutState
                    : activeTab === 'stock-production'
                    ? setStockProductionState
                    : activeTab === 'stock-opname'
                    ? setStockOpnameState
                    : undefined
                } 
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function ProductInventoryApp() {
  return (
    <TransaksiProvider>
      <ProductInventoryInner />
    </TransaksiProvider>
  );
}
