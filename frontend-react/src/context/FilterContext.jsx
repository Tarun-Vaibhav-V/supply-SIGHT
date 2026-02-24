import { useState, createContext, useContext } from 'react';

const FilterContext = createContext(null);

export function useFilters() {
    return useContext(FilterContext);
}

export function FilterProvider({ children }) {
    const [filters, setFilters] = useState({
        companyId: '',
        status: [],
        severity: [],
        search: '',
    });

    const updateFilter = (key, value) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const toggleChip = (key, value) => {
        setFilters((prev) => {
            const arr = prev[key];
            if (arr.includes(value)) {
                return { ...prev, [key]: arr.filter((v) => v !== value) };
            }
            return { ...prev, [key]: [...arr, value] };
        });
    };

    const resetFilters = () => {
        setFilters({ companyId: '', status: [], severity: [], search: '' });
    };

    return (
        <FilterContext.Provider value={{ filters, updateFilter, toggleChip, resetFilters }}>
            {children}
        </FilterContext.Provider>
    );
}
