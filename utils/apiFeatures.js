import QueryProcessor from './queryProcessor.js';

/**
 * API Features - Simplified query processing utility
 * Combines all query processing features in a fluent interface
 * 
 * @example
 * const features = new ApiFeatures(Product.find(), req.query)
 *   .filter()
 *   .sort()
 *   .paginate()
 *   .selectFields();
 * 
 * const products = await features.query;
 * const pagination = features.pagination;
 */
export class ApiFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.pagination = null;
  }

  /**
   * Filter query
   */
  filter() {
    const queryObj = { ...this.queryString };
    const excludedFields = ['page', 'sort', 'limit', 'fields', 'search', 'populate'];
    
    excludedFields.forEach(field => delete queryObj[field]);

    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt|in|ne)\b/g, match => `$${match}`);
    
    const parsedQuery = JSON.parse(queryStr);

    if (this.queryString.search) {
      parsedQuery.$or = [
        { title: { $regex: this.queryString.search, $options: 'i' } },
        { description: { $regex: this.queryString.search, $options: 'i' } }
      ];
    }

    this.query = this.query.find(parsedQuery);
    return this;
  }

  /**
   * Sort results
   */
  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(',').join(' ');
      this.query = this.query.sort(sortBy);
    } else {
      this.query = this.query.sort('-createdAt');
    }
    return this;
  }

  /**
   * Limit fields
   */
  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    }
    return this;
  }

  /**
   * Paginate
   */
  paginate() {
    const page = parseInt(this.queryString.page, 10) || 1;
    const limit = parseInt(this.queryString.limit, 10) || 10;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    this.pagination = {
      page,
      limit,
      skip
    };

    return this;
  }

  /**
   * Populate referenced documents
   */
  populate(populateOptions) {
    if (this.queryString.populate) {
      const populateFields = this.queryString.populate.split(',').join(' ');
      this.query = this.query.populate(populateFields);
    } else if (populateOptions) {
      this.query = this.query.populate(populateOptions);
    }
    return this;
  }

  /**
   * Get pagination metadata
   * @param {number} total - Total number of documents
   * @param {number} page - Current page number
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
}

export default ApiFeatures;

