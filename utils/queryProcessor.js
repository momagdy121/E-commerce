/**
 * Process and build MongoDB query with pagination, sorting, filtering, and field selection
 * 
 * @param {Object} query - MongoDB query object
 * @param {Object} queryString - Express request query object
 * @returns {Object} - Processed query options
 */

class QueryProcessor {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  /**
   * Filter query based on query parameters
   * Supports: exact match, range (gte, lte, gt, lt), in, regex
   * 
   * @example
   * ?price[gte]=100&price[lte]=500&category=electronics
   */
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search'];
    
    // Remove pagination and sorting fields
    excludedFields.forEach(field => delete queryObj[field]);

    // Convert query string to MongoDB query
    let queryStr = JSON.stringify(queryObj);
    
    // Replace operators (gte, lte, gt, lt, in) with MongoDB operators
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in)\b/g, match => `$${match}`);
    
    // Parse back to object
    const parsedQuery = JSON.parse(queryStr);

    // Handle search (text search)
    if (this.queryString.search) {
      parsedQuery.$text = { $search: this.queryString.search };
    }

    this.query = this.query.find(parsedQuery);
    return this;
  }

  /**
   * Sort results
   * @example ?sort=-createdAt,price (descending createdAt, ascending price)
   */
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      // Default sort by createdAt descending
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  /**
   * Select specific fields
   * @example ?fields=name,email,price
   */
  selectFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    }
    return this;
  }

  /**
   * Paginate results
   * @example ?page=2&limit=10
   */
  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return {
      page,
      limit,
      skip
    };
  }

  /**
   * Get pagination metadata
   * @param {number} total - Total number of documents
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   */
  static getPaginationMeta(total, page, limit) {
    const pages = Math.ceil(total / limit);
    
    return {
      pagination: {
        currentPage: page,
        totalPages: pages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < pages,
        hasPrevPage: page > 1
      }
    };
  }

  /**
   * Execute all query processing steps
   */
  async execute() {
    const pagination = this.paginate();
    const results = await this.query;
    return {
      results,
      pagination
    };
  }
}

/**
 * Advanced query processor with more features
 */
export class AdvancedQueryProcessor extends QueryProcessor {
  /**
   * Filter by date range
   * @example ?dateFrom=2024-01-01&dateTo=2024-12-31
   */
  filterByDateRange() {
    if (this.queryString.dateFrom || this.queryString.dateTo) {
      const dateFilter = {};
      if (this.queryString.dateFrom) {
        dateFilter.$gte = new Date(this.queryString.dateFrom);
      }
      if (this.queryString.dateTo) {
        dateFilter.$lte = new Date(this.queryString.dateTo);
      }
      this.query = this.query.find({ createdAt: dateFilter });
    }
    return this;
  }

  /**
   * Filter by price range
   * @example ?minPrice=100&maxPrice=500
   */
  filterByPriceRange() {
    if (this.queryString.minPrice || this.queryString.maxPrice) {
      const priceFilter = {};
      if (this.queryString.minPrice) {
        priceFilter.$gte = parseFloat(this.queryString.minPrice);
      }
      if (this.queryString.maxPrice) {
        priceFilter.$lte = parseFloat(this.queryString.maxPrice);
      }
      this.query = this.query.find({ price: priceFilter });
    }
    return this;
  }

  /**
   * Filter by multiple values (array)
   * @example ?category=electronics,clothing,books
   */
  filterByArray(field) {
    if (this.queryString[field]) {
      const values = this.queryString[field].split(',');
      this.query = this.query.find({ [field]: { $in: values } });
    }
    return this;
  }

  /**
   * Populate referenced fields
   * @example ?populate=category,user
   */
  populate() {
    if (this.queryString.populate) {
      const populateFields = this.queryString.populate.split(',').join(' ');
      this.query = this.query.populate(populateFields);
    }
    return this;
  }
}

export default QueryProcessor;

